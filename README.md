# Bahmni Clinic configuration and data.

### [![Bahmni Config](https://github.com/BahmniIndiaDistro/clinic-config/actions/workflows/deploy.yml/badge.svg)](https://github.com/BahmniIndiaDistro/clinic-config/actions/workflows/deploy.yml)

This repo represents configuration for India Clinics.

### CI

Push to main would trigger gha which would inturn trigger bahmni-india-package.
This would create a helm chart and manual run of workflow would deploy it to https://lite.mybahmni.in/

## References to openmrs-module-initializer for Bahmni

https://github.com/CRUDEM/openmrs-config-hsc

https://github.com/Siko099/openmrs-config-uganda

## Steps to follow for openmrs initializer to load masterdata

Step 1: **cd package/docker**

Step 2: Make sure we have CSV's with respective folder names inside **masterdata/configuration** folder

    configuration/
        ├── addresshierarchy/
        ├── locations/
        ├── privileges/
        ├── roles/

Step 3: **docker-compose up -d**

Step 4: Login to openmrs https://localhost/openmrs

    Username:admin
    Password:Admin123

###Note:

    All the liquibase changesets in **masterdata/configuration** are only added temporarily for testing.