import org.apache.commons.lang.StringUtils
import org.hibernate.Query
import org.hibernate.SessionFactory;
import org.openmrs.Obs;
import org.openmrs.Patient;
import org.openmrs.Concept;
import org.openmrs.Encounter;
import org.openmrs.module.bahmniemrapi.encountertransaction.contract.BahmniObservation
import org.openmrs.util.OpenmrsUtil;
import org.openmrs.api.context.Context;
import org.openmrs.module.bahmniemrapi.obscalculator.ObsValueCalculator;
import org.openmrs.module.bahmniemrapi.encountertransaction.contract.BahmniEncounterTransaction
import org.openmrs.module.emrapi.encounter.domain.EncounterTransaction;

import org.joda.time.LocalDate;
import org.joda.time.Months;

public class BahmniObsValueCalculator implements ObsValueCalculator {

    static Map<BahmniObservation, BahmniObservation> obsParentMap = new HashMap<BahmniObservation, BahmniObservation>();

    public void run(BahmniEncounterTransaction bahmniEncounterTransaction) {
        calculateAndAdd(bahmniEncounterTransaction)
    }

    static def calculateAndAdd(BahmniEncounterTransaction bahmniEncounterTransaction) {
        Collection<BahmniObservation> observations = bahmniEncounterTransaction.getObservations()

        def nowAsOfEncounter = bahmniEncounterTransaction.getEncounterDateTime() != null ? bahmniEncounterTransaction.getEncounterDateTime() : new Date()

        BahmniObservation heightObservation = find("Height (cm)", observations, null)
        BahmniObservation weightObservation = find("Weight (kg)", observations, null)
        BahmniObservation parent = null

        if (hasValue(heightObservation) || hasValue(weightObservation)) {
            def heightObs = null, weightObs = null
            Encounter encounter = Context.getEncounterService().getEncounterByUuid(bahmniEncounterTransaction.getEncounterUuid());
            if (encounter != null) {
                Set<Obs> latestObsOfEncounter = encounter.getObsAtTopLevel(true)
                latestObsOfEncounter.each { Obs latestObs ->
                    for (Obs groupMember : latestObs.groupMembers) {
                        heightObs = heightObs ? heightObs : (groupMember.concept.getName().name.equalsIgnoreCase("Height (cm)") ? groupMember : null)
                        weightObs = weightObs ? weightObs : (groupMember.concept.getName().name.equalsIgnoreCase("Weight (kg)") ? groupMember : null)
                    }
                }
                if (isSameObs(heightObservation, heightObs) && isSameObs(weightObservation, weightObs)) {
                    return
                }
            }

            BahmniObservation bmiObservation = find("Body Mass Index", observations, null)

            parent = obsParent(heightObservation, parent)
            parent = obsParent(weightObservation, parent)

            if ((heightObservation && heightObservation.voided) && (weightObservation && weightObservation.voided)) {
                voidObs(bmiObservation)
                return
            }

            Double height = hasValue(heightObservation) && !heightObservation.voided ? heightObservation.getValue() as Double : null
            Double weight = hasValue(weightObservation) && !weightObservation.voided ? weightObservation.getValue() as Double : null
            Date obsDatetime = getDate(weightObservation) != null ? getDate(weightObservation) : getDate(heightObservation)

            if (height == null || weight == null) {
                voidObs(bmiObservation)
                return
            }

            bmiObservation = bmiObservation ?: createObs("Body Mass Index", parent, bahmniEncounterTransaction, obsDatetime) as BahmniObservation
            def bmi = bmi(height, weight)
            bmiObservation.setValue(bmi)

            return
        }

    }

    private static BahmniObservation obsParent(BahmniObservation child, BahmniObservation parent) {
        if (parent != null) return parent

        if (child != null) {
            return obsParentMap.get(child)
        }
    }

    private static Date getDate(BahmniObservation observation) {
        return hasValue(observation) && !observation.voided ? observation.getObservationDateTime() : null
    }

    private static boolean isSameObs(BahmniObservation observation, Obs editedObs) {
        if(observation && editedObs) {
            return  (editedObs.uuid == observation.encounterTransactionObservation.uuid && editedObs.valueNumeric == observation.value)
        } else if(observation == null && editedObs == null) {
            return true
        }
        return false
    }

    private static boolean hasValue(BahmniObservation observation) {
        return observation != null && observation.getValue() != null && !StringUtils.isEmpty(observation.getValue().toString())
    }

    private static void voidObs(BahmniObservation bmiObservation) {
        if (hasValue(bmiObservation)) {
            bmiObservation.voided = true
        }
    }

    static BahmniObservation createObs(String conceptName, BahmniObservation parent, BahmniEncounterTransaction encounterTransaction, Date obsDatetime) {
        def concept = Context.getConceptService().getConceptByName(conceptName)
        BahmniObservation newObservation = new BahmniObservation()
        newObservation.setConcept(new EncounterTransaction.Concept(concept.getUuid(), conceptName))
        newObservation.setObservationDateTime(obsDatetime)
        parent == null ? encounterTransaction.addObservation(newObservation) : parent.addGroupMember(newObservation)
        return newObservation
    }

    static def bmi(Double height, Double weight) {
        Double heightInMeters = height / 100
        Double value = weight / (heightInMeters * heightInMeters)
        def bmiValue = new BigDecimal(value).setScale(2, BigDecimal.ROUND_HALF_UP).doubleValue()
        if(bmiValue > 100){
            throw new IllegalArgumentException("Please enter valid Height and Weight")
        }
        return bmiValue
    };

    static BahmniObservation find(String conceptName, Collection<BahmniObservation> observations, BahmniObservation parent) {
        for (BahmniObservation observation : observations) {
            if (conceptName.equalsIgnoreCase(observation.getConcept().getName())) {
                obsParentMap.put(observation, parent)
                return observation
            }
            BahmniObservation matchingObservation = find(conceptName, observation.getGroupMembers(), observation)
            if (matchingObservation) {
                return matchingObservation
            } 
        }
        return null
    }

}