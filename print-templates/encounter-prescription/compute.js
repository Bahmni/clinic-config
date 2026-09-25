// No ProviderAttributeType for license number yet, so hardcode until it's added.
const LICENSE_NUMBER_PLACEHOLDER = '-';

module.exports = {
  compute: async function ({ context, resolved, ValidationError, fhirPath }) {
    if (!context?.patientUUID) throw new ValidationError('patientUUID is required');
    if (!context?.encounterUuid) throw new ValidationError('encounterUuid is required');

    // "patient" bundle also carries AllergyIntolerance via _revinclude; split by resourceType.
    const patient = fhirPath(resolved?.patient, "Bundle.entry.resource.where(resourceType = 'Patient').first()");
    const allergyResources = toArray(
      fhirPath(resolved?.patient, "Bundle.entry.resource.where(resourceType = 'AllergyIntolerance')"),
    );

    // Practitioner?_id= ignores the filter on this server, so fetch by direct read instead.
    const provider = resolved?.providerPractitioner;

    return {
      patientName: fhirPath(patient, 'name.first().text') ?? '',
      patientId: fhirPath(patient, "identifier.where(use = 'official').first().value") ?? '',
      birthDate: fhirPath(patient, 'birthDate') ?? '',
      gender: fhirPath(patient, 'gender') ?? '',
      address: buildAddress(fhirPath, patient),

      allergies: buildAllergies(fhirPath, allergyResources),
      conditions: buildConditions(fhirPath, resolved?.conditions),
      diagnoses: buildDiagnoses(fhirPath, resolved?.diagnoses, context.encounterUuid),
      chiefComplaints: buildChiefComplaints(fhirPath, resolved?.chiefComplaintObs),
      medications: buildMedications(fhirPath, resolved?.medicationRequests),
      investigations: buildInvestigations(fhirPath, resolved?.investigations),
      vitals: buildVitals(fhirPath, resolved?.vitals),

      providerName: fhirPath(provider, 'name.first().text') ?? '',
      providerLicenseNumber: LICENSE_NUMBER_PLACEHOLDER,
    };
  },
};

function toArray(val) {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

function refId(reference) {
  return reference?.split('/')?.[1] ?? '';
}

// House number/locality live in a nested OpenMRS address extension, not plain FHIR Address fields.
const ADDRESS_EXT = 'http://fhir.openmrs.org/ext/address';

function addressExtPath(field) {
  return `address.first().extension.where(url = '${ADDRESS_EXT}').extension.where(url = '${ADDRESS_EXT}#${field}').valueString`;
}

function buildAddress(fhirPath, patient) {
  const houseNumber = fhirPath(patient, addressExtPath('address1')) ?? '';
  const locality = fhirPath(patient, addressExtPath('address2')) ?? '';
  const city = fhirPath(patient, 'address.first().city') ?? '';
  const district = fhirPath(patient, 'address.first().district') ?? '';
  const state = fhirPath(patient, 'address.first().state') ?? '';
  const postalCode = fhirPath(patient, 'address.first().postalCode') ?? '';
  const composed = [houseNumber, locality, city, district, state, postalCode].filter(Boolean).join(', ');
  return composed || (fhirPath(patient, 'address.first().text') ?? '');
}

function buildAllergies(fhirPath, resources) {
  return (resources ?? []).map((a) => ({
    allergen: fhirPath(a, 'code.text') ?? fhirPath(a, 'code.coding.first().display') ?? '',
    // Falls back to criticality only when no reaction severity is recorded.
    severity: fhirPath(a, 'reaction.where(severity.exists()).severity.first()') ?? fhirPath(a, 'criticality') ?? '',
    reactions: toArray(fhirPath(a, 'reaction.manifestation'))
      .map((m) => m.text ?? m.coding?.[0]?.display ?? '')
      .filter(Boolean),
    recordedBy: fhirPath(a, 'recorder.display') ?? '',
    recordedDate: fhirPath(a, 'recordedDate') ?? '',
  }));
}

function buildConditions(fhirPath, bundle) {
  return toArray(fhirPath(bundle, 'Bundle.entry.resource')).map((c) => ({
    name: fhirPath(c, 'code.text') ?? fhirPath(c, 'code.coding.first().display') ?? '',
    onsetDate: fhirPath(c, 'onsetDateTime') ?? '',
    recordedBy: fhirPath(c, 'recorder.display') ?? '',
    note: toArray(fhirPath(c, 'note.text')).filter(Boolean).join('; '),
  }));
}

function buildDiagnoses(fhirPath, bundle, encounterUuid) {
  return toArray(fhirPath(bundle, 'Bundle.entry.resource'))
    .filter((d) => refId(fhirPath(d, 'encounter.reference')) === encounterUuid)
    .map((d) => ({
      name: fhirPath(d, 'code.text') ?? fhirPath(d, 'code.coding.first().display') ?? '',
      certainty: fhirPath(d, 'verificationStatus.coding.first().display') ?? fhirPath(d, 'verificationStatus.coding.first().code') ?? '',
      recordedDate: fhirPath(d, 'recordedDate') ?? '',
      note: toArray(fhirPath(d, 'note.text')).filter(Boolean).join('; '),
    }));
}

function buildChiefComplaints(fhirPath, bundle) {
  const resources = toArray(fhirPath(bundle, 'Bundle.entry.resource'));
  const byId = new Map(resources.map((o) => [o.id, o]));
  const groups = resources.filter((o) => toArray(fhirPath(o, 'hasMember')).length > 0);

  return groups
    .map((group) => {
      const members = toArray(fhirPath(group, 'hasMember.reference'))
        .map((ref) => byId.get(refId(ref)))
        .filter(Boolean);
      const coded = members.find((m) => fhirPath(m, 'code.text') === 'Chief Complaint Coded');
      const freeText = members.find((m) => fhirPath(m, 'code.text') === 'Chief complaint (text)');
      const durationValue = members.find((m) => fhirPath(m, 'code.text') === 'Sign/symptom duration');
      const durationUnit = members.find((m) => fhirPath(m, 'code.text') === 'Chief Complaint Duration');

      const complaint = fhirPath(coded, 'valueCodeableConcept.text') ?? '';
      const notes = fhirPath(freeText, 'valueString') ?? '';
      const durationVal = fhirPath(durationValue, 'valueQuantity.value');
      const durationUnitText = fhirPath(durationUnit, 'valueCodeableConcept.text');
      const duration = durationVal != null && durationUnitText ? `${durationVal} ${durationUnitText}` : '';

      return { complaint: complaint || notes, notes: complaint && notes ? notes : '', duration };
    })
    .filter((c) => c.complaint);
}

function buildMedications(fhirPath, bundle) {
  const medicationResources = toArray(fhirPath(bundle, "Bundle.entry.resource.where(resourceType = 'Medication')"));
  const medicationMap = new Map(
    medicationResources.map((m) => [m.id, fhirPath(m, 'form.text') ?? fhirPath(m, 'form.coding.first().display') ?? '']),
  );
  const medicationRequests = toArray(fhirPath(bundle, "Bundle.entry.resource.where(resourceType = 'MedicationRequest')"));

  return medicationRequests
    .filter((mr) => ['active', 'on-hold'].includes(fhirPath(mr, 'status')))
    .map((mr) => {
      const baseName = fhirPath(mr, 'medicationCodeableConcept.text') ?? fhirPath(mr, 'medicationReference.display') ?? '';
      const dosageForm = medicationMap.get(refId(fhirPath(mr, 'medicationReference.reference'))) ?? '';
      const priority =
        fhirPath(mr, 'priority') === 'stat' ? 'STAT' : fhirPath(mr, 'dosageInstruction.first().asNeededBoolean') ? 'PRN' : '';

      return {
        drugName: dosageForm ? `${baseName} (${dosageForm})` : baseName,
        dosageInstructions: buildDosageInstructions(fhirPath, mr.dosageInstruction),
        startDate: fhirPath(mr, 'dosageInstruction.first().timing.event.first()') ?? fhirPath(mr, 'authoredOn') ?? '',
        treatmentNotes: parseAdditionalInstructions(fhirPath(mr, 'dosageInstruction.first().text')) || fhirPath(mr, 'note.first().text') || '',
        priority,
      };
    });
}

// Matches prescriptions/compute.js's buildDosageInstructions so both templates render the same way.
function buildDosageInstructions(fhirPath, dosageInstruction) {
  const d = toArray(dosageInstruction)[0];
  if (!d) return '';

  const parts = [];
  const doseValue = fhirPath(d, 'doseAndRate.first().doseQuantity.value');
  if (doseValue != null) parts.push(`${doseValue} ${fhirPath(d, 'doseAndRate.first().doseQuantity.unit') ?? ''}`.trim());

  const frequency = fhirPath(d, 'timing.code.text');
  if (frequency) parts.push(frequency);

  const instructions = parseInstructions(fhirPath(d, 'text'));
  if (instructions) parts.push(instructions);

  if (fhirPath(d, 'asNeededBoolean')) parts.push('SOS');

  const route = fhirPath(d, 'route.text');
  if (route) parts.push(route);

  const duration = fhirPath(d, 'timing.repeat.duration');
  if (duration != null) {
    return `${parts.join(', ')} - ${duration} ${durationLabel(fhirPath(d, 'timing.repeat.durationUnit'))}`;
  }
  return parts.join(', ');
}

function parseInstructions(text) {
  if (!text) return '';
  try {
    const instr = JSON.parse(text)?.instructions ?? '';
    return instr.toLowerCase() === 'as directed' ? '' : instr;
  } catch {
    return text;
  }
}

function parseAdditionalInstructions(text) {
  if (!text) return '';
  try {
    return JSON.parse(text)?.additionalInstructions ?? '';
  } catch {
    return '';
  }
}

function durationLabel(code) {
  const map = { s: 'Seconds', min: 'Minutes', h: 'Hours', d: 'Days', wk: 'Weeks', mo: 'Months', a: 'Years' };
  return map[code] ?? code ?? '';
}

// Grouped dynamically by category; requests with no category are dropped.
function buildInvestigations(fhirPath, bundle) {
  const requests = toArray(fhirPath(bundle, 'Bundle.entry.resource'));

  const groups = new Map();
  for (const sr of requests) {
    const orderType = fhirPath(sr, 'category.first().text') ?? fhirPath(sr, 'category.first().coding.first().display') ?? '';
    if (!orderType) continue;

    if (!groups.has(orderType)) groups.set(orderType, []);
    groups.get(orderType).push({
      name: fhirPath(sr, 'code.text') ?? fhirPath(sr, 'code.coding.first().display') ?? '',
      // meta.lastUpdated reflects order status changes; authoredOn stays fixed at creation.
      orderDate: fhirPath(sr, 'meta.lastUpdated') ?? '',
      note: toArray(fhirPath(sr, 'note.text')).filter(Boolean).join('; '),
    });
  }

  return Array.from(groups, ([orderType, items]) => ({ orderType, items }));
}

// Only Blood Pressure groups its components (Systolic/Diastolic/Body position) via hasMember;
// other vitals are flat Observations. Takes the latest reading per concept since a form can
// be filled more than once per encounter.
const VITAL_DISPLAY_ORDER = [
  'Temperature',
  'Pulse',
  'Respiratory rate',
  'Systolic blood pressure',
  'Diastolic blood pressure',
  'Body position',
  'Arterial blood oxygen saturation (pulse oximeter)',
];

function buildVitals(fhirPath, bundle) {
  const resources = toArray(fhirPath(bundle, 'Bundle.entry.resource'));
  const byId = new Map(resources.map((o) => [o.id, o]));
  const groups = resources.filter((o) => toArray(fhirPath(o, 'hasMember')).length > 0);
  const groupMemberIds = new Set(groups.flatMap((g) => toArray(fhirPath(g, 'hasMember.reference')).map(refId)));

  const flatObs = resources.filter((o) => !groups.includes(o) && !groupMemberIds.has(o.id));
  const memberObs = groups.flatMap((g) =>
    toArray(fhirPath(g, 'hasMember.reference'))
      .map((ref) => byId.get(refId(ref)))
      .filter(Boolean),
  );

  const latestByConcept = new Map();
  for (const obs of [...flatObs, ...memberObs]) {
    const concept = fhirPath(obs, 'code.text') ?? fhirPath(obs, 'code.coding.first().display') ?? '';
    if (!concept) continue;

    const time = fhirPath(obs, 'effectiveDateTime') ?? fhirPath(obs, 'issued') ?? '';
    if (!latestByConcept.has(concept) || time > latestByConcept.get(concept).time) {
      latestByConcept.set(concept, { time, obs });
    }
  }

  return VITAL_DISPLAY_ORDER.filter((concept) => latestByConcept.has(concept)).map((concept) => {
    const obs = latestByConcept.get(concept).obs;
    return {
      concept,
      value: vitalValue(fhirPath, obs),
      range: vitalRangeLabel(fhirPath, obs),
      abnormal: fhirPath(obs, 'interpretation.first().coding.first().code') === 'A',
    };
  });
}

function vitalValue(fhirPath, obs) {
  const qtyValue = fhirPath(obs, 'valueQuantity.value');
  if (qtyValue != null) {
    const unit = fhirPath(obs, 'valueQuantity.unit');
    return `${qtyValue}${unit ? ` ${unit}` : ''}`;
  }
  if (fhirPath(obs, 'valueCodeableConcept')) {
    return fhirPath(obs, 'valueCodeableConcept.text') ?? fhirPath(obs, 'valueCodeableConcept.coding.first().display') ?? '';
  }
  return fhirPath(obs, 'valueString') ?? '';
}

function vitalRangeLabel(fhirPath, obs) {
  const ranges = toArray(fhirPath(obs, 'referenceRange'));
  const range = ranges.find((r) => fhirPath(r, 'type.coding.first().code') === 'normal') ?? ranges[0];
  if (!range) return '';

  const low = fhirPath(range, 'low.value');
  const high = fhirPath(range, 'high.value');
  const unit = fhirPath(range, 'low.unit') ?? fhirPath(range, 'high.unit') ?? '';
  let label = '';
  if (low != null && high != null) label = `(${low} - ${high})`;
  else if (low != null) label = `(>${low})`;
  else if (high != null) label = `(<${high})`;
  if (!label) return '';
  return unit ? `${label} ${unit}` : label;
}
