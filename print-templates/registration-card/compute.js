const ADDRESS_EXT = 'http://fhir.openmrs.org/ext/address';

function addrExt(field) {
  return `Bundle.entry.first().resource.address.first()` +
    `.extension.where(url = '${ADDRESS_EXT}')` +
    `.extension.where(url = '${ADDRESS_EXT}#${field}').valueString`;
}

module.exports = {
  compute: async function ({ context, data, resolved, ValidationError, fhirPath }) {
    const patientBundle   = resolved?.patient;
    const relativesBundle = resolved?.relatives;
    const profile = resolved?.patientProfile;
    
    const houseNumber = fhirPath(patientBundle, addrExt('address1')) ?? '';
    const locality = fhirPath(patientBundle, addrExt('address2')) ?? '';
    const state = fhirPath(patientBundle, "Bundle.entry.first().resource.address.first().state") ?? '';
    const postalCode = fhirPath(patientBundle, "Bundle.entry.first().resource.address.first().postalCode") ?? '';

    return {
      patientId:             fhirPath(patientBundle, "Bundle.entry.first().resource.identifier.where(use = 'official').first().value") ?? '',
      patientName:           fhirPath(patientBundle, "Bundle.entry.first().resource.name.first().text") ?? '',
      birthDate:             fhirPath(patientBundle, "Bundle.entry.first().resource.birthDate") ?? '',
      gender:                fhirPath(patientBundle, "Bundle.entry.first().resource.gender") ?? '',
      phone:                 fhirPath(patientBundle, "Bundle.entry.first().resource.telecom.where(system = 'phone').first().value") ?? '',
      address:              [houseNumber, locality, state, postalCode].filter(Boolean).join(", "),
      village:               fhirPath(patientBundle, "Bundle.entry.first().resource.address.first().city") ?? '',
      tehsil:                fhirPath(patientBundle, "Bundle.entry.first().resource.address.first().district") ?? '',
      registrationDate:      profile?.patient?.auditInfo?.dateCreated ?? '',
      nextOfKinName:         fhirPath(relativesBundle, "Bundle.entry.first().resource.name.first().text") ?? '',
      nextOfKinRelationship: fhirPath(relativesBundle, "Bundle.entry.first().resource.relationship.first().text") ?? '',
      photoUrl:              `/openmrs/ws/rest/v1/patientImage?patientUuid=${context.patientUuid}`,
    };
  },
};
