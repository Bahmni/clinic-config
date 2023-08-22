FROM alpine:3.18.3

COPY openmrs /etc/bahmni_config/openmrs
COPY masterdata /etc/bahmni_config/masterdata

COPY package/docker/start.sh start.sh
RUN chmod +x start.sh
CMD ["./start.sh"]
