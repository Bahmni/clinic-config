'use strict';

angular.module('bahmni.common.displaycontrol.custom')
    .directive('patientAppointmentsDashboard', ['$http', '$q', '$window','appService', function ($http, $q, $window, appService) {
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
            var date = Bahmni.Common.Util.DateUtil.formatDateWithoutTime(start_date_time);
            var timeSlot = Bahmni.Common.Util.DateUtil.formatTime(start_date_time) + " - " + Bahmni.Common.Util.DateUtil.formatTime(end_date_time);
            return [date, timeSlot];
        };
        $q.all([getUpcomingAppointments(), getPastAppointments()]).then(function (response) {
            $scope.upcomingAppointments = response[0].data;
            $scope.upcomingAppointmentsUUIDs = [];
            $scope.teleconsultationAppointments = [];
            for (var i=0; i<$scope.upcomingAppointments.length; i++) {
                $scope.upcomingAppointmentsUUIDs[i] = $scope.upcomingAppointments[i].uuid;
                $scope.teleconsultationAppointments[i] = $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_TELECONSULTATION;
                delete $scope.upcomingAppointments[i].uuid;
                const [date, timeSlot] = convertUTCtoLocal($scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_START_DATE_KEY, $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_END_DATE_KEY);
                delete $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_START_DATE_KEY;
                delete $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_END_DATE_KEY;
                $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_DATE_KEY = date;
                $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_SLOT_KEY = timeSlot;
                delete $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_TELECONSULTATION;
            }
            $scope.upcomingAppointmentsHeadings = _.keys($scope.upcomingAppointments[0]);
            $scope.pastAppointments = response[1].data;
            $scope.pastAppointmentsHeadings = _.keys($scope.pastAppointments[0]);
        });

        $scope.goToListView = function () {
            $window.open('/bahmni/appointments/#/home/manage/appointments/list');
        };
        $scope.openJitsiMeet = function (appointmentIndex) {
            var jitsiMeetingId = $scope.upcomingAppointmentsUUIDs[appointmentIndex];
            appService.setTeleConsultationVars(jitsiMeetingId, true);
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
