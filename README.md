# Bahmni Clinic configuration and data.

### [![Bahmni Config](https://github.com/Bahmni/clinic-config/actions/workflows/build_upload.yml/badge.svg)](https://github.com/Bahmni/clinic-config/actions/workflows/build_upload.yml)

This repo represents configuration for BahmniLite (more applicable for clinics).

## References to openmrs-module-initializer for Bahmni

https://github.com/CRUDEM/openmrs-config-hsc

https://github.com/Siko099/openmrs-config-uganda

## Steps to follow for openmrs initializer to load masterdata  [ For Development Purpose ]

Step 1: Latest OpenMRS image is already packaged with openmrs-initializer-module. Make sure you have **openmrs-initializer-module** in modules directory(`/usr/local/tomcat/.Openmrs/modules`). If not **copy or package openmrs-initializer-module** into your openmrs modules.

Step 2: Follow the steps [here](https://github.com/Bahmni/bahmni-package/tree/master/bahmni-docker#local-development-on-config) to volume mount your local folder.

Step 3: Make sure we have CSV's with respective folder names inside **masterdata/configuration** folder in **source folder** of **clinic-config**

    configuration/
        ├── addresshierarchy/
        ├── locations/
        ├── privileges/
        ├── roles/

Step 4: Starting up docker would load up openmrs initializer

Step 5: On every change in masterdata folder of clinic-config restart openmrs service by running `docker-compose restart openmrs`

### Note:

    All the liquibase changesets in **masterdata/configuration** are only added temporarily for testing.