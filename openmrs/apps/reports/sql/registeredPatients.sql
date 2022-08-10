SELECT
  (@rownum := @rownum + 1)                                  AS "Sr. No.",
  pi.identifier    										                      AS "Patient Id",
  concat(pn.given_name, " ", ifnull(pn.family_name, ""))    AS "Patient Name",
  floor(DATEDIFF(NOW(), p.birthdate) / 365)                 AS "Age",
  p.gender                                                  AS "Gender",
  DATE_FORMAT(pt.date_created, "%d-%b-%Y")                  AS "Registration Date"

FROM patient pt
  JOIN person p ON p.person_id = pt.patient_id AND p.voided is FALSE
  JOIN patient_identifier pi ON p.person_id = pi.patient_id AND pi.voided is FALSE
  JOIN patient_identifier_type pit ON pi.identifier_type = pit.patient_identifier_type_id AND pit.retired is FALSE
  JOIN person_name pn ON pn.person_id = p.person_id AND pn.voided is FALSE
  CROSS JOIN (SELECT @rownum := 0) AS dummy
  WHERE pt.voided is FALSE
  AND cast(pt.date_created AS DATE) BETWEEN '#startDate#' AND '#endDate#'
GROUP BY pi.identifier;