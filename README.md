# Bahmni Clinic configuration and data.

### [![Bahmni Config](https://github.com/BahmniIndiaDistro/clinic-config/actions/workflows/deploy.yml/badge.svg)](https://github.com/BahmniIndiaDistro/clinic-config/actions/workflows/deploy.yml)

This repo represents configuration for India Clinics.

### CI

Push to main would trigger the deploy.yml GHA that would deploy the latest
config to clinic.bahmni-covid19.in environment (basically gha would SSH into the
ec2 using the pem from repository secrets and perform git pull where the
clinic_config directory is volume mounted on bahmni-web and openmrs containers
as default_config). This is currently a temporary CI solution - we would
eventually migrate to K8s once we move to India AWS account.

Note: any changes to docker-compose would not redeploy the containers on the
environment. You would still need to SSH into the EC2 box and manually restart
the containers.
