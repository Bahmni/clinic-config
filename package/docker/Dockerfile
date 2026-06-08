FROM alpine:3.22

COPY openmrs /etc/bahmni_config/openmrs
COPY masterdata /etc/bahmni_config/masterdata
COPY print-templates /etc/bahmni_config/print-templates

COPY package/docker/start.sh start.sh
RUN chmod +x start.sh
CMD ["./start.sh"]
