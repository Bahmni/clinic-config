module.exports = {
  compute: async function ({ context, data, resolved, ValidationError, fhirPath }) {
    const patientBundle   = resolved?.patient;
    const relativesBundle = resolved?.relatives;
    const profile         = resolved?.patientProfile;

    return {
      patientId:             fhirPath(patientBundle, "Bundle.entry.first().resource.identifier.where(use = 'official').first().value") ?? '',
      patientName:           fhirPath(patientBundle, "Bundle.entry.first().resource.name.first().text") ?? '',
      birthDate:             fhirPath(patientBundle, "Bundle.entry.first().resource.birthDate") ?? '',
      age:                   computeAge(fhirPath(patientBundle, "Bundle.entry.first().resource.birthDate")),
      gender:                fhirPath(patientBundle, "Bundle.entry.first().resource.gender") ?? '',
      phone:                 fhirPath(patientBundle, "Bundle.entry.first().resource.telecom.where(system = 'phone').first().value") ?? '',
      address:               fhirPath(patientBundle, "Bundle.entry.first().resource.address.first().text") ?? '',
      village:               fhirPath(patientBundle, "Bundle.entry.first().resource.address.first().city") ?? '',
      tehsil:                fhirPath(patientBundle, "Bundle.entry.first().resource.address.first().district") ?? '',
      registrationDate:      profile?.patient?.auditInfo?.dateCreated ?? '',
      nextOfKinName:         fhirPath(relativesBundle, "Bundle.entry.first().resource.name.first().text") ?? '',
      nextOfKinRelationship: fhirPath(relativesBundle, "Bundle.entry.first().resource.relationship.first().text") ?? '',
      photoUrl:              `/openmrs/ws/rest/v1/patientImage?patientUuid=${context.patientUuid}`,
    };
  },
};

function computeAge(birthDate) {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  const now   = new Date();
  const days  = Math.floor((now - birth) / (1000 * 60 * 60 * 24));
  if (days < 30)   return `${days} days`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} months`;
  return `${Math.floor(months / 12)} years`;
}
