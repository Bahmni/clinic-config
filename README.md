# Bahmni Clinic configuration and data.

### [![Bahmni Config](https://github.com/BahmniIndiaDistro/clinic-config/actions/workflows/build_upload.yml/badge.svg)](https://github.com/BahmniIndiaDistro/clinic-config/actions/workflows/build_upload.yml)

This repo represents configuration for India Clinics.

### CI

Push to main would trigger gha which would inturn trigger bahmni-india-package.
This would create a helm chart and manual run of workflow would deploy it to https://lite.mybahmni.in/

## References to openmrs-module-initializer for Bahmni

https://github.com/CRUDEM/openmrs-config-hsc

https://github.com/Siko099/openmrs-config-uganda

## Steps to follow for openmrs initializer to load masterdata [ For developement purpose ]

Step 1: docker-compose can be invoked from bahmni-india-package [repo](https://github.com/BahmniIndiaDistro/bahmni-india-package).

Step 2: Make sure you have **openmrs-initializer-module** in modules directory. If not **copy openmrs-initializer-module** into your openmrs modules.

Step 3: Volume mount **masterdata/configuration** folder in your openmrs service of docker-compose.yml.

Step 4: Make sure we have CSV's with respective folder names inside **masterdata/configuration** folder

    configuration/
        ├── addresshierarchy/
        ├── locations/
        ├── privileges/
        ├── roles/

Step 5: Starting up openmrs docker would load up openmrs initializer

Step 6: Login to openmrs https://localhost/openmrs

    Username:admin
    Password:Admin123

### Note:

    All the liquibase changesets in **masterdata/configuration** are only added temporarily for testing.