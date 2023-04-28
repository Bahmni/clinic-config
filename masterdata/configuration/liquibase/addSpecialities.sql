CREATE PROCEDURE add_new_speciality(speciality_name VARCHAR(50),
                             speciality_date_created TIME,
                             speciality_creator_id INT(11),
                             speciality_uuid VARCHAR(38)
                        )
BEGIN
    SELECT count(distinct speciality_id) into @speciality_count from appointment_speciality where name = speciality_name;
    IF @speciality_count < 1 THEN
        INSERT INTO appointment_speciality (name, date_created, creator, uuid) VALUES (speciality_name, speciality_date_created, speciality_creator_id, speciality_uuid);
    END IF;
END;
