# Bahmni Clinic configuration and data.

### [![Bahmni Config](https://github.com/Bahmni/clinic-config/actions/workflows/build_upload.yml/badge.svg)](https://github.com/Bahmni/clinic-config/actions/workflows/build_upload.yml)

This repo represents configuration for BahmniLite (more applicable for clinics).

## References to openmrs-module-initializer for Bahmni

https://github.com/CRUDEM/openmrs-config-hsc

https://github.com/Siko099/openmrs-config-uganda

## Steps to follow for openmrs initializer to load masterdata  [ For Development Purpose ]

Step 1: Latest OpenMRS image is already packaged with openmrs-initializer-module. Make sure you have **openmrs-initializer-module** in modules directory(`/openmrs/data/modules`). If not **copy or package openmrs-initializer-module** into your openmrs modules.

Step 2: Follow the steps [here](https://github.com/Bahmni/bahmni-package/tree/master/bahmni-docker#local-development-on-config) to volume mount your local folder.

Step 3: Make sure we have CSV's with respective folder names inside **masterdata/configuration** folder in **source folder** of **clinic-config**

    configuration/
        ├── addresshierarchy/
        ├── locations/
        ├── privileges/
        ├── roles/

Step 4: Starting up docker would load up openmrs initializer

Step 5: On every change in masterdata folder of clinic-config restart openmrs service by running `docker-compose restart openmrs`

### **Note:**

1. All the liquibase changesets in **masterdata/configuration** are only added temporarily for testing.


2. Backup of OpenMRS DB with pre-loaded CIEL Concepts and checksums of masterdata/configuration are maintained in [bahmni-scripts](https://github.com/Bahmni/bahmni-scripts/tree/master/demo/db-backups/1.0.0-lite) repository

3. Whenever we are loading the CIEL zip for the first time we would need a restart of openmrs to retire duplicate diagnosis concepts from CIEL


### Transifex for Language Translations:

Currently, both clinic-config and default-config sharing the same transifex configuration.
This need to fixed in the future, have to create separate configuration for clinic-config. Because, these are technically different config folders. They may have same files right now, but as time progresses, they can easily deviate.

For now, we need to be careful, that we always add a UNIQUE KEY across default-config and clinic-config. Also note that, for the same Key+English string, the translation in other languages returned by transifex will be the same across default-config or clinic-config, since the **memory** is the same for transifex.

[Dev Notes for translating Bahmni](https://bahmni.atlassian.net/wiki/spaces/BAH/pages/41287695/Dev+Notes+for+Translating+Bahmni)