module.exports = {
  compute: async function ({ context, resolved, ValidationError, fhirPath,translate }) {
    if (!context?.patientUuid) throw new ValidationError('patientUuid is required');
    if (!context?.visitUuid) throw new ValidationError('visitUuid is required');

    // Patient demographics
    const patientBundle = resolved?.patient;
    const patientName   = fhirPath(patientBundle, "Bundle.entry.first().resource.name.first().text") ?? '';
    const patientId     = fhirPath(patientBundle, "Bundle.entry.first().resource.identifier.where(use = 'official').first().value") ?? '';
    const birthDate     = fhirPath(patientBundle, "Bundle.entry.first().resource.birthDate") ?? '';
    const gender        = fhirPath(patientBundle, "Bundle.entry.first().resource.gender") ?? '';
    const village       = fhirPath(patientBundle, "Bundle.entry.first().resource.address.first().city") ?? '';
    const district      = fhirPath(patientBundle, "Bundle.entry.first().resource.address.first().district") ?? '';
    const postalAddress = fhirPath(patientBundle,
      "Bundle.entry.first().resource.address.first().extension.where(url = 'http://fhir.openmrs.org/ext/address').extension.where(url = 'http://fhir.openmrs.org/ext/address#address2').valueString") ?? '';

    // Extract resources from the medication bundle by type
    const mrBundle = resolved?.medicationRequests;
    const visitRef = `Encounter/${context.visitUuid}`;
    const medicationResources = toArray(fhirPath(mrBundle, "Bundle.entry.where(resource.resourceType = 'Medication').resource"));
    const visitEncounters     = toArray(fhirPath(mrBundle, `Bundle.entry.where(resource.resourceType = 'Encounter' and resource.partOf.reference = '${visitRef}').resource`));
    const encounterResources  = toArray(fhirPath(mrBundle, "Bundle.entry.where(resource.resourceType = 'Encounter').resource"));
    const allMedRequests      = toArray(fhirPath(mrBundle, "Bundle.entry.where(resource.resourceType = 'MedicationRequest').resource"));

    const medicationMap     = new Map(medicationResources.map((m) => [m.id, m.form?.text ?? m.form?.coding?.[0]?.display ?? '']));
    const visitEncounterIds = new Set(visitEncounters.map((enc) => enc.id));
    const encounterMap      = new Map(encounterResources.map((e) => [e.id, e]));

    // Group visit medications by encounter
    const byEncounter = allMedRequests
      .filter((mr) => visitEncounterIds.has(refId(mr.encounter?.reference)))
      .reduce((map, mr) => {
        const encId = refId(mr.encounter?.reference);
        if (!map.has(encId)) map.set(encId, []);
        map.get(encId).push(mr);
        return map;
      }, new Map());

    const firstStart = [...byEncounter.keys()]
      .map((id) => fhirPath(encounterMap.get(id), 'period.start'))
      .find(Boolean);

    const medications = [...byEncounter.entries()].map(([encId, meds]) => ({
      doctorName: fhirPath(encounterMap.get(encId), 'participant.first().individual.display') ?? '',
      drugOrders: meds.map((mr) => {
        const stopped      = ['stopped', 'cancelled'].includes(mr.status);
        const baseName     = mr.medicationCodeableConcept?.text ?? mr.medicationReference?.display ?? '';
        const dosageForm   = medicationMap.get(refId(mr.medicationReference?.reference)) ?? '';
        
        return {
          drugName:           dosageForm ? `${baseName} (${dosageForm})` : baseName,
          dosageInstructions: buildDosageInstructions(mr.dosageInstruction),
          startDate:          formatDate(mr.authoredOn ?? ''),
          stopped,
          stoppedDate:        stopped ? formatDate(fhirPath(mr, 'meta.lastUpdated') ?? '') : '',
          treatmentNotes:     parseAdditionalInstructions(mr.dosageInstruction?.[0]?.text),
        };
      }),
    }));

    if (medications.length === 0) throw new ValidationError(translate("NO_MEDICATIONS_PRESCRIBED"));

    return {
      patientName,
      patientId,
      age:          computeAge(birthDate),
      gender,
      village,
      postalAddress,
      district,
      visitDate:    firstStart ? formatDate(firstStart) : '',
      medications,
    };
  },
};

// evaluateFhirPath returns the item directly (not array) when there is exactly one result,
// so always normalise to an array before iterating.
function toArray(val) {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

function computeAge(birthDate) {
  if (!birthDate) return '';
  const birth  = new Date(birthDate);
  const now    = new Date();
  const days   = Math.floor((now - birth) / (1000 * 60 * 60 * 24));
  if (days < 30)   return `${days} days`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} months`;
  return `${Math.floor(months / 12)} years`;
}

function refId(reference) {
  return reference?.split('/')?.[1] ?? '';
}

function buildDosageInstructions(dosageInstruction) {
  const d = dosageInstruction?.[0];
  if (!d) return '';

  const parts   = [];
  const doseQty = d.doseAndRate?.[0]?.doseQuantity;
  if (doseQty?.value != null) parts.push(`${doseQty.value} ${doseQty.unit ?? ''}`.trim());

  const frequency = d.timing?.code?.text;
  if (frequency) parts.push(frequency);

  const instructions = parseInstructions(d.text);
  if (instructions) parts.push(instructions);

  if (d.asNeededBoolean) parts.push('SOS');

  const route = d.route?.text;
  if (route) parts.push(route);

  const repeat = d.timing?.repeat;
  if (repeat?.duration != null) {
    return `${parts.join(', ')} - ${repeat.duration} ${durationLabel(repeat.durationUnit)}`;
  }
  return parts.join(', ');
}

function parseInstructions(text) {
  if (!text) return '';
  try {
    const instr = JSON.parse(text)?.instructions ?? '';
    return instr.toLowerCase() === 'as directed' ? '' : instr;
  } catch {
    return '';
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

function formatDate(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    const day   = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleDateString('en', { month: 'long' });
    return `${day} ${month} ${date.getFullYear()}`;
  } catch {
    return '';
  }
}
