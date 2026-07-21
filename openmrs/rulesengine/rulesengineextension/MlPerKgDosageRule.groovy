package org.openmrs.module.rulesengine.rule;

import org.openmrs.Patient;
import org.openmrs.module.rulesengine.domain.DosageRequest;
import org.openmrs.module.rulesengine.domain.Dose;
import org.openmrs.module.rulesengine.domain.RuleName;
import org.openmrs.module.rulesengine.service.ObservationService;
import org.openmrs.module.rulesengine.service.PatientService;
import org.openmrs.module.rulesengine.util.BahmniMath;
import org.openmrs.module.rulesengine.util.Validator;

@RuleName(name = "ml/kg")
public class MlPerKgDosageRule implements DosageRule {

      public Dose calculateDose(DosageRequest request) throws Exception {

          Patient patient = PatientService.getPatientByUuid(request.getPatientUuid());

          Double weight = ObservationService.getLatestObsValueNumeric(

              patient, ObservationService.ConceptRepo.WEIGHT, request.getVisitUuid()

          );

          Validator.validate(weight, ObservationService.ConceptRepo.WEIGHT);

          Double roundUpValue = BahmniMath.getTwoDigitRoundUpValue(request.getBaseDose() * weight);

          return new Dose(request.getDrugName(), roundUpValue, Dose.DoseUnit.ml);

      }

  }