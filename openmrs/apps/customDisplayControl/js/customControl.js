'use strict';

angular.module('bahmni.common.displaycontrol.custom')
    .directive('patientAppointmentsDashboard', ['$http', '$q', '$window','appService', 'virtualConsultService', function ($http, $q, $window, appService, virtualConsultService) {
    var link = function ($scope) {
        $scope.contentUrl = appService.configBaseUrl() + "/customDisplayControl/views/patientAppointmentsDashboard.html";
        var getUpcomingAppointments = function () {
            var params = {
                q: "bahmni.sqlGet.upComingAppointments",
                v: "full",
                patientUuid: $scope.patient.uuid
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };
        var getPastAppointments = function () {
            var params = {
                q: "bahmni.sqlGet.pastAppointments",
                v: "full",
                patientUuid: $scope.patient.uuid
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };
        var convertUTCtoLocal = function (start_date_time, end_date_time) {
            const monthIndex = 1;
            start_date_time[monthIndex]--;
            end_date_time[monthIndex]--;
            let startDateTimeInLocalTimeZone = getUpdatedDateTimeInLocalTimeZone(start_date_time);
            let endDateTimeInLocalTimeZone = getUpdatedDateTimeInLocalTimeZone(end_date_time);
            let appointmentStartDate = Bahmni.Common.Util.DateUtil.formatDateWithoutTime(startDateTimeInLocalTimeZone);
            let timeSlot = Bahmni.Common.Util.DateUtil.formatTime(startDateTimeInLocalTimeZone) + " - " + Bahmni.Common.Util.DateUtil.formatTime(endDateTimeInLocalTimeZone);
            return [appointmentStartDate, timeSlot];
        };
        var getUpdatedDateTimeInLocalTimeZone = function (dateTimeInUtc) {
            let timezoneOffsetMinutes = new Date().getTimezoneOffset();
            return Bahmni.Common.Util.DateUtil.addMinutes(Bahmni.Common.Util.DateUtil.parse(dateTimeInUtc), -timezoneOffsetMinutes);
        }
        $q.all([getUpcomingAppointments(), getPastAppointments()]).then(function (response) {
            $scope.upcomingAppointments = response[0].data;
            $scope.upcomingAppointmentsUUIDs = [];
            $scope.teleconsultationAppointments = [];
            $scope.upcomingAppointmentsLinks = [];
            for (var i=0; i<$scope.upcomingAppointments.length; i++) {
                $scope.upcomingAppointmentsUUIDs[i] = $scope.upcomingAppointments[i].uuid;
                $scope.teleconsultationAppointments[i] = 'Virtual' === $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_KIND;
                delete $scope.upcomingAppointments[i].uuid;
                const [date, timeSlot] = convertUTCtoLocal($scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_START_DATE_KEY, $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_END_DATE_KEY);
                delete $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_START_DATE_KEY;
                delete $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_END_DATE_KEY;
                $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_DATE_KEY = date;
                $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_SLOT_KEY = timeSlot;
                $scope.upcomingAppointmentsLinks[i] = $scope.upcomingAppointments[i].tele_health_video_link || "";
                delete $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_KIND;
                delete $scope.upcomingAppointments[i].tele_health_video_link;
            }
            $scope.upcomingAppointmentsHeadings = _.keys($scope.upcomingAppointments[0]);
            $scope.pastAppointments = response[1].data;
            for (let i = 0; i < $scope.pastAppointments.length; i++) {
                let appointmentDateParts = $scope.pastAppointments[i].DASHBOARD_APPOINTMENTS_DATE_KEY.split("/");
                let appointmentDay = appointmentDateParts[0];
                let appointmentMonth = appointmentDateParts[1];
                let appointmentYear = appointmentDateParts[2];
                let appointmentDate = Bahmni.Common.Util.DateUtil.formatDateWithoutTime(new Date(appointmentYear, appointmentMonth - 1, appointmentDay));
                let slotStartTime = $scope.pastAppointments[i].DASHBOARD_APPOINTMENTS_SLOT_KEY.split("-")[0].trim();
                let slotEndTime = $scope.pastAppointments[i].DASHBOARD_APPOINTMENTS_SLOT_KEY.split("-")[1].trim();
                let slotStartTimeInLocalTimeZone = getUpdatedDateTimeInLocalTimeZone(Bahmni.Common.Util.DateUtil.formatDateWithTime(appointmentDate + " " + slotStartTime));
                let slotEndTimeInLocalTimeZone = getUpdatedDateTimeInLocalTimeZone(Bahmni.Common.Util.DateUtil.formatDateWithTime(appointmentDate + " " + slotEndTime));
                let updatedSlotStartTime = Bahmni.Common.Util.DateUtil.formatTime(slotStartTimeInLocalTimeZone);
                let updatedSlotEndTime = Bahmni.Common.Util.DateUtil.formatTime(slotEndTimeInLocalTimeZone);
                $scope.pastAppointments[i].DASHBOARD_APPOINTMENTS_SLOT_KEY = updatedSlotStartTime + " - " + updatedSlotEndTime;
                $scope.pastAppointments[i].DASHBOARD_APPOINTMENTS_DATE_KEY = Bahmni.Common.Util.DateUtil.formatDateWithoutTime(slotStartTimeInLocalTimeZone);
            }
            $scope.pastAppointmentsHeadings = _.keys($scope.pastAppointments[0]);
        });

        $scope.goToListView = function () {
            $window.open('/bahmni/appointments/#/home/manage/appointments/list');
        };
        $scope.openJitsiMeet = function (appointmentIndex) {
            var uuid = $scope.upcomingAppointmentsUUIDs[appointmentIndex];
            var link = $scope.upcomingAppointmentsLinks[appointmentIndex];
            virtualConsultService.launchMeeting(uuid, link);
        };
        $scope.showJoinTeleconsultationOption = function (appointmentIndex) {
            return $scope.upcomingAppointments[appointmentIndex].DASHBOARD_APPOINTMENTS_STATUS_KEY == 'Scheduled' &&
                    $scope.teleconsultationAppointments[appointmentIndex];
        }
    };
    return {
        restrict: 'E',
        link: link,
        scope: {
            patient: "=",
            section: "="
        },
        template: '<ng-include src="contentUrl"/>'
    };
}]);
