# Bahmni Clinic configuration and data.

### [![Bahmni Config](https://github.com/BahmniIndiaDistro/clinic-config/actions/workflows/deploy.yml/badge.svg)](https://github.com/BahmniIndiaDistro/clinic-config/actions/workflows/deploy.yml)

This repo represents configuration for India Clinics.

### CI

Push to main would trigger 2 yaml files.
Common things done: Basically gha would SSH into the
ec2 using the pem from repository secrets and perform git clone where the
clinic_config directory is volume mounted on bahmni-web and openmrs containers
as default_config

This would deploy the latest config to clinic.bahmni-covid19.in environment.
1) deploy_clinic_config.yml --> paths-ignored: masterdata config folders
2) deploy_masterdata.yml --> paths-only: masterdata config folders

This is currently a temporary CI solution - we would
eventually migrate to K8s once we move to India AWS account.

Note: any changes to docker-compose would not redeploy the containers on the
environment. You would still need to SSH into the EC2 box and manually restart
the containers.

## References to openmrs-module-initializer for Bahmni

https://github.com/CRUDEM/openmrs-config-hsc
https://github.com/Siko099/openmrs-config-uganda

## Steps to follow for openmrs initializer to load masterdata 

Step 1: **cd docker/masterdata**

Step 2: Make sure we have CSV's with respective folder names inside **masterdata/configuration** folder 
    
    configuration/
        ├── addresshierarchy/
        ├── locations/
        ├── privileges/
        ├── roles/
Step 3: In **docker/masterdata/modules** folder place the respective omods if required.

Step 4: **docker-compose up -d**

Step 5: Login to openmrs https://localhost/openmrs
            
    Username:admin
    Password:Admin123