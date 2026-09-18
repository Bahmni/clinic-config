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

        const zeroIndexMonth = (dateTimeArray) => {
            const zeroIndexedMonth = dateTimeArray.slice();
            zeroIndexedMonth[1] -= 1;
            return zeroIndexedMonth;
        };

        const transformDate = (dateTimeArray) => {
            return Bahmni.Common.Util.DateUtil.formatDateWithoutTimeToLocal(
                zeroIndexMonth(dateTimeArray),
            );
        };

        const transformTime = (dateTimeArray) => {
            return Bahmni.Common.Util.DateUtil.formatTimeToLocal(
                zeroIndexMonth(dateTimeArray),
            );
        };

        var getAppointmentDateAndSlot = function (startTimeInMillseconds, endTimeInMillseconds) {
            let appointmentStartDate = transformDate(startTimeInMillseconds);
            let timeSlot = transformTime(startTimeInMillseconds) + " - " + transformTime(endTimeInMillseconds) ;
            return [appointmentStartDate, timeSlot];
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
                const [date, timeSlot] = getAppointmentDateAndSlot($scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_START_DATE_IN_UTC_KEY, $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_END_DATE_IN_UTC_KEY);
                delete $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_START_DATE_IN_UTC_KEY;
                delete $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_END_DATE_IN_UTC_KEY;
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
                const [date, timeSlot] = getAppointmentDateAndSlot($scope.pastAppointments[i].DASHBOARD_APPOINTMENTS_START_DATE_IN_UTC_KEY, $scope.pastAppointments[i].DASHBOARD_APPOINTMENTS_END_DATE_IN_UTC_KEY);
                delete $scope.pastAppointments[i].DASHBOARD_APPOINTMENTS_START_DATE_IN_UTC_KEY;
                delete $scope.pastAppointments[i].DASHBOARD_APPOINTMENTS_END_DATE_IN_UTC_KEY;
                $scope.pastAppointments[i].DASHBOARD_APPOINTMENTS_DATE_KEY = date;
                $scope.pastAppointments[i].DASHBOARD_APPOINTMENTS_SLOT_KEY = timeSlot;
            }
            $scope.pastAppointmentsHeadings = _.keys($scope.pastAppointments[0]);
        });

        $scope.goToListView = function () {
            $window.open('/appointments/#/home/manage/appointments/list');
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

angular.module('bahmni.common.displaycontrol.custom')
    .directive('patientPrintDashboard', ['$http', '$q', '$window','appService', function ($http, $q, $window, appService) {
        var link = async function ($scope) {
            $scope.printConstants = {};
            var request = {
                method: 'get',
                url: appService.configBaseUrl() + "/customDisplayControl/constants/printConstants.json",
                dataType: 'json',
                contentType: "application/json"
            };
            await $http(request)
                .success(function (jsonData) {
                    $scope.printConstants = jsonData;
                })
                .error(function () {

                });
            var {formNames, printControls,  doctorRegistrationFieldValue, providerIdentifier, practitionerType, patientAddress, addressAndLocationAttributes} = $scope.printConstants;

            $scope.patientAddress = {line1:"",line2:""};
            $scope.printControl = printControls;
            $scope.formFieldValues = {};
            $scope.contentUrl = appService.configBaseUrl() + "/customDisplayControl/views/printCertificate.html";
            $scope.today = new Date();
            $scope.loggedInUser = $scope.$root.currentUser;
            $scope.registeredClinicName = '';
            $scope.registeredClinicAddress = '';
            $scope.registrationNumber = '';
            $scope.doctorName = '';
            var buildAddress= function(regAddress,fieldValues){
                var addressValue = '';
                var count = 0;
                fieldValues.forEach((eachField) => {
                    if(regAddress[eachField]) {
                        addressValue += ((count ===0 ) ? '' : ', ') + capitalizeFirstLetter(regAddress[eachField]);
                        count++;
                    }
                });
                return addressValue;
            }
            var capitalizeFirstLetter = function (str) {
                if(!isNaN(str)) {
                    return str;
                }
                return str[0].toUpperCase() + str.slice(1).toLowerCase();
            }
            $scope.patientAddress.line1 = buildAddress($scope.patient.address, patientAddress.line1)
            $scope.patientAddress.line2 = buildAddress($scope.patient.address, patientAddress.line2)
            $scope.printCertificate = function (printId) {
                let printContents, styles;
                printContents = document.getElementById(printId).innerHTML;
                styles = '<link id="print-certificate-styles" rel="stylesheet" href="/bahmni_config/openmrs/apps/customDisplayControl/styles/print.css"/>';
                var frame1 = document.createElement('iframe');
                frame1.name = "frame1";
                frame1.style.position = "absolute";
                frame1.style.top = "-1000000px";
                document.body.appendChild(frame1);
                var frameDoc = frame1.contentWindow ? frame1.contentWindow : frame1.contentDocument.document ? frame1.contentDocument.document : frame1.contentDocument;
                frameDoc.document.open();
                frameDoc.document.write('<html><head>');
                frameDoc.document.write(`<div class="print-wrap">${styles}</div></head><body>`);
                frameDoc.document.write(printContents);
                frameDoc.document.write('</body></html>');
                frameDoc.document.close();
                setTimeout(function () {
                    window.frames["frame1"].focus();
                    window.frames["frame1"].print();
                    document.body.removeChild(frame1);
                }, 500);
                return false;
            }

            var getLoggedInUser = function () {
                var params = {
                    v: "full"

                };
                return $http.get('/openmrs/ws/rest/v1/provider', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };

            var getVisits = function () {
                var params = {
                    v: "custom:(uuid,visitType,startDatetime,stopDatetime,location,encounters:(uuid))",
                    includeInactive: true,
                    patient: $scope.patient.uuid
                };
                return $http.get('/openmrs/ws/rest/v1/visit', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };
            var getObservationsByVisitId = function (visitId) {
                var params = {
                    visitUuid: visitId,
                    patient: $scope.patient.uuid
                };
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/observations', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };
            var getClinicLocation = function () {
                var params = {
                    operator: "ALL",
                    s: "byTags",
                    tags: 'Facility',
                    v: 'full'
                };
                return $http.get('/openmrs/ws/rest/v1/location', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };
            var getAttributeValue = function (attributeList,attributeFieldValue) {
                 var selectedAttribute = attributeList.find(attribute =>
                                            (!attribute.voided) && attribute.attributeType.display === attributeFieldValue
                                        );
                                        if (selectedAttribute) {
                                            return selectedAttribute.value;
                                        }
                                        return "";

            };
            var getLatestEncounterForForm = function (observationList, formName) {
                if (observationList.length == 0) {
                    return observationList;
                }
                $scope.printControl[formName] = observationList.length === 0;
                observationList.sort((b, a) => sortDate(a["encounterDateTime"], b["encounterDateTime"]));

                var latestEncounterId = observationList[0]["encounterUuid"];
                return observationList.filter(item => item["encounterUuid"] === latestEncounterId);
            }
            var sortDate = function (a, b) {
                return (a === null && b === null) ? 0
                    : (a === null) ? 1
                        : (b === null) ? -1
                            : (a > b)
                                ? 1 : ((b) > a) ? -1 : 0;
            }

            $q.all([getLoggedInUser(), getVisits(), getClinicLocation()]).then(function (response) {
                var data = response[0].data;
                var observationData = response[1].data;
                var locationsData = response[2].data;
                var personDetails;

               if (data.results.length > 0) {
                   personDetails = data.results.find(provider => provider.person.uuid == $scope.loggedInUser.person.uuid);
                   var doctor = personDetails.attributes.find(attribute => (attribute.display.includes($scope.printConstants.practitionerType) && attribute.display.includes($scope.printConstants.providerIdentifier)));
                   if (personDetails) {
                       if(doctor){
                       $scope.doctorName = personDetails.person.display;
                       }
                      $scope.registrationNumber = getAttributeValue(personDetails.attributes, doctorRegistrationFieldValue);
                   }
               }

                if (observationData.results.length > 0) {
                    var visitId = observationData.results[0].uuid
                    $q.all([getObservationsByVisitId(visitId)]).then(function (visitResponse) {
                        var observationsValue = visitResponse[0].data;
                        if (observationsValue.length > 0) {
                            var formObservations = formNames.map(form => {
                                var formObservation = {};
                                (getLatestEncounterForForm(observationsValue.filter(item => item.formFieldPath && item.formFieldPath.includes(form)), form).forEach(eachObservation => (formObservation[eachObservation.concept.name] = (isNaN(eachObservation.valueAsString) ? eachObservation.valueAsString : parseFloat(eachObservation.valueAsString)))));
                                return formObservation
                            });
                            $scope.formFieldValues = formObservations;

                        }
                    });
                }
                if (locationsData.results.length > 0) {
                    var location = locationsData.results[0];
                    $scope.registeredClinicName = location.name;
                    $scope.registeredClinicAddress = getAttributeValue(location.attributes, addressAndLocationAttributes);
                }
            });
        };

        return {
            restrict: 'E',
            link: link,
            scope: {
                patient: "=",
                section: "=",
                observation: "=?"
            },
            template: '<ng-include src="contentUrl"/>'
        };
    }]);

// Vaidra doorway — launch with visit context; on return, claim write code → save Consultation Note.
angular.module('bahmni.common.displaycontrol.custom')
    .directive('vaidraVisitLaunch', ['$window', '$location', '$state', 'appService', '$rootScope', '$http', '$q', 'configurations',
        function ($window, $location, $state, appService, $rootScope, $http, $q, configurations) {
            var C = Bahmni.Common.Constants;
            var NOTE = C.consultationNoteConceptName;
            var CHART_REQUEST = 'vaidra-ehr-chart-request';
            var CHART_REPLY = 'vaidra-ehr-chart';

            function fail(message) {
                return $q.reject({ message: message });
            }

            function originOf(url) {
                try { return new URL(url).origin; } catch (e) { return ''; }
            }

            function readTicket(win, loc) {
                try {
                    if (loc && loc.search && loc.search().vaidraWriteTicket) return loc.search().vaidraWriteTicket;
                    var q = new URLSearchParams(win.location.search || '').get('vaidraWriteTicket');
                    if (q) return q;
                    var m = /[?&]vaidraWriteTicket=([^&]+)/.exec(win.location.hash || '');
                    return m ? decodeURIComponent(m[1]) : null;
                } catch (e) { return null; }
            }

            // Reload with a clean URL. $state.reload can run before commits
            function clearTicket(win, loc) {
                try {
                    var url = new URL(win.location.href);
                    var changed = url.searchParams.has('vaidraWriteTicket');
                    url.searchParams.delete('vaidraWriteTicket');

                    var hash = url.hash || '';
                    var queryAt = hash.indexOf('?');
                    if (queryAt !== -1) {
                        var hashParams = new URLSearchParams(hash.slice(queryAt + 1));
                        if (hashParams.has('vaidraWriteTicket')) {
                            changed = true;
                            hashParams.delete('vaidraWriteTicket');
                            url.hash = hash.slice(0, queryAt) +
                                (hashParams.toString() ? '?' + hashParams.toString() : '');
                        }
                    }
                    if (changed) {
                        win.location.replace(url.toString());
                        return true;
                    }
                    if (loc && loc.search && loc.search().vaidraWriteTicket) {
                        loc.search('vaidraWriteTicket', null).replace();
                    }
                } catch (e) { }
                return false;
            }

            function cachedNoteUuid() {
                var note = configurations.consultationNoteConcept && configurations.consultationNoteConcept();
                return note && note.uuid;
            }

            function lookupConceptUuid(name) {
                return $http.get(C.conceptSearchByFullNameUrl, {
                    params: { name: name, v: 'custom:(uuid)' }
                }).then(function (res) {
                    var row = res.data && res.data.results && res.data.results[0];
                    return (row && row.uuid) || null;
                }, function () { return null; });
            }

            function resolveConceptUuid(names) {
                var list = names && names.length ? names : [NOTE];
                var cached = cachedNoteUuid();
                if (cached && list.indexOf(NOTE) !== -1) return $q.when(cached);
                return list.reduce(function (chain, name) {
                    return chain.then(function (found) {
                        return found || (name === NOTE && cached) || lookupConceptUuid(name);
                    });
                }, $q.when(null));
            }

            function encounterName(e) {
                var t = e && e.encounterType;
                if (!t) return '';
                return (typeof t === 'string' ? t : (t.display || t.name || '')).toString();
            }

            function pickEncounter(encounters) {
                var open = (encounters || []).filter(function (e) { return e.uuid && !e.voided; });
                var consult = open.filter(function (e) { return /consultation/i.test(encounterName(e)); });
                var pool = consult.length ? consult : open;
                return pool.length ? pool[pool.length - 1].uuid : null;
            }

            function resolveEncounterUuid(visitUuid, preferred) {
                if (preferred) return $q.when(preferred);
                var slim = 'custom:(uuid,encounters:(uuid,voided,encounterType:(uuid,display,name)))';
                var url = C.visitUrl + '/' + encodeURIComponent(visitUuid);
                return $http.get(url, { params: { v: slim } }).then(function (res) {
                    return pickEncounter(res.data && res.data.encounters);
                }, function () {
                    return $http.get(url, { params: { v: 'full' } }).then(function (res) {
                        return pickEncounter(res.data && res.data.encounters);
                    });
                });
            }

            function dataOf(req) {
                return req.then(function (r) { return r.data; }, angular.noop);
            }

            function prefetchChart(patientUuid, visitUuid) {
                var enc = encodeURIComponent(patientUuid);
                return $q.all({
                    patient: dataOf($http.get(C.RESTWS_V1 + '/patient/' + enc, { params: { v: 'full' } })),
                    observations: visitUuid ? dataOf($http.get(C.observationsUrl, {
                        params: { visitUuid: visitUuid, patient: patientUuid }
                    })) : $q.when(null),
                    diagnoses: dataOf($http.get(C.bahmniDiagnosisUrl, { params: { patientUuid: patientUuid } })),
                    medications: dataOf($http.get(C.bahmniDrugOrderUrl, { params: { patientUuid: patientUuid } })),
                    allergies: $http.get(C.RESTWS_V1 + '/patient/' + enc + '/allergy').then(function (r) {
                        return r && r.status === 204 ? null : (r && r.data);
                    }, angular.noop),
                    visit: visitUuid ? dataOf($http.get(C.visitUrl + '/' + encodeURIComponent(visitUuid), {
                        params: { v: 'full' }
                    })) : $q.when(null)
                }).then(null, function () { return null; });
            }

            function ticketIsSpent(err, claimed) {
                if (claimed) return true;
                var status = err && err.status;
                return status === 410 || status === 404;
            }

            function explainError(err, apiBase, claimed) {
                var status = err && err.status;
                var retry = ticketIsSpent(err, claimed)
                    ? ' End the visit again from Vaidra to retry.'
                    : ' Refresh this page to retry the save.';
                if (status === -1 || status === 0 || (err && err.message === 'Network Error')) {
                    if (location.protocol === 'https:' && /^http:\/\//i.test(apiBase || '')) {
                        return 'Cannot reach Vaidra. Refresh this page to retry the save.';
                    }
                    return 'Cannot reach Vaidra. Refresh this page to retry the save.';
                }
                var body = err && err.data && (err.data.message || err.data.error || err.data.exception);
                if (Array.isArray(body)) body = body.join('; ');
                if (body && typeof body === 'object') body = body.message || body.detail || null;
                if (typeof body === 'string' && body.trim()) {
                    return /retry/i.test(body) ? body : body.replace(/[. ]*$/, '') + '.' + retry;
                }
                if (err && err.message) {
                    return /retry/i.test(err.message) ? err.message : err.message.replace(/[. ]*$/, '') + '.' + retry;
                }
                return (status ? 'Could not save note (HTTP ' + status + ').' : 'Could not save note.') + retry;
            }

            function link($scope) {
                $scope.contentUrl = appService.configBaseUrl() + '/customDisplayControl/views/vaidraVisitLaunch.html';
                var closed = $scope.visitSummary && $scope.visitSummary.stopDateTime;
                $scope.canLaunch = !!$scope.visitUuid && !closed;
                $scope.writeStatus = null;
                $scope.writeMessage = '';

                var cfg = $scope.config || {};
                var webBase = (cfg.vaidraWebBaseUrl || '').replace(/\/$/, '');
                var apiBase = (cfg.vaidraApiBaseUrl || '').replace(/\/$/, '');
                var configuredSite = (cfg.vaidraSiteId || '').trim();
                var siteId = (configuredSite && configuredSite.toLowerCase() !== 'bahmni')
                    ? configuredSite
                    : (($window.location.host || '').trim());
                var vaidraOrigin = originOf(webBase);

                var chart = null, chartReady = false, waiters = [], prefetchStarted = false;
                function publishChart(next) {
                    chart = next;
                    chartReady = true;
                    waiters.splice(0).forEach(function (fn) { fn(); });
                }
                function ensureChart() {
                    if (prefetchStarted || !$scope.patient || !$scope.patient.uuid) return;
                    prefetchStarted = true;
                    prefetchChart($scope.patient.uuid, $scope.visitUuid).then(publishChart);
                }
                function onChartRequest(event) {
                    if (!vaidraOrigin || event.origin !== vaidraOrigin) return;
                    if (!event.data || event.data.type !== CHART_REQUEST || !event.source) return;
                    var reply = function () {
                        event.source.postMessage({ type: CHART_REPLY, v: 1, chart: chart }, event.origin);
                    };
                    chartReady ? reply() : waiters.push(reply);
                }
                $window.addEventListener('message', onChartRequest);
                $scope.$on('$destroy', function () {
                    $window.removeEventListener('message', onChartRequest);
                });
                ensureChart();

                $scope.openInVaidra = function () {
                    if (!$scope.canLaunch || !$scope.patient || !$scope.patient.uuid) return;
                    if (!webBase || !siteId || !apiBase) {
                        $scope.writeStatus = 'error';
                        $scope.writeMessage = 'Missing ' + (!webBase ? 'vaidraWebBaseUrl' : !apiBase ? 'vaidraApiBaseUrl' : 'Bahmni host for site id') + ' in visit config.';
                        return;
                    }
                    var q = new URLSearchParams({
                        source: 'bahmni',
                        site: siteId,
                        patient: $scope.patient.uuid,
                        visit: $scope.visitUuid,
                        ehrOrigin: $window.location.origin
                    });
                    var providerUuid = $rootScope.currentProvider && $rootScope.currentProvider.uuid;
                    if (providerUuid) q.set('provider', providerUuid);
                    ensureChart();
                    $window.open(webBase + '/ehr/launch?' + q.toString(), '_blank');
                };

                var writeCode = readTicket($window, $location);
                if (!writeCode) return;

                $scope.writeStatus = 'saving';
                $scope.writeMessage = 'Saving Consultation Note from Vaidra…';

                var claimed = false;
                var ticketId;
                var tickets = apiBase + '/ehr/bahmni/write-tickets';

                function completeTicket(status, extras) {
                    if (!ticketId) return $q.when();
                    var body = { status: status, code: writeCode };
                    if (extras) {
                        if (extras.vendorResponse) body.vendorResponse = extras.vendorResponse;
                        if (extras.error) body.error = extras.error;
                    }
                    return $http.post(tickets + '/' + encodeURIComponent(ticketId) + '/complete', body);
                }

                $http.post(tickets + '/claim', { code: writeCode }).then(function (res) {
                    claimed = true;
                    var handoff = res.data || {};
                    ticketId = handoff.ticketId;
                    if (!ticketId) return fail('Vaidra write handoff did not return a ticket');
                    if (handoff.patientUuid !== $scope.patient.uuid) {
                        return fail('Vaidra note is for a different patient than this visit');
                    }
                    if (handoff.visitUuid !== $scope.visitUuid) {
                        return fail('Vaidra note is for a different visit');
                    }
                    var names = handoff.noteConceptNames || [NOTE];
                    return $q.all({
                        conceptUuid: resolveConceptUuid(names),
                        encounterUuid: resolveEncounterUuid(handoff.visitUuid, handoff.encounterUuid)
                    }).then(function (ids) {
                        if (!ids.conceptUuid) return fail('Consultation Note concept not found');
                        if (!ids.encounterUuid) return fail('No Consultation encounter on this visit');
                        return $http.post(C.bahmniEncounterUrl, {
                            patientUuid: handoff.patientUuid,
                            visitUuid: handoff.visitUuid,
                            encounterUuid: ids.encounterUuid,
                            locationUuid: handoff.locationUuid,
                            providers: handoff.providerUuid ? [{ uuid: handoff.providerUuid }] : undefined,
                            observations: [{
                                concept: { uuid: ids.conceptUuid, name: names[0] || NOTE },
                                value: handoff.noteText
                            }]
                        });
                    });
                }).then(function (saved) {
                    return completeTicket('completed', { vendorResponse: (saved && saved.data) || {} });
                }).then(function (done) {
                    if (!done || !done.data || done.data.status !== 'completed') {
                        return fail('Vaidra did not accept the OpenMRS save proof');
                    }
                    $scope.writeStatus = 'saved';
                    $scope.writeMessage = 'Consultation Note saved to this visit.';
                    if (!clearTicket($window, $location)) return $state.reload();
                }).catch(function (err) {
                    $scope.writeStatus = 'error';
                    $scope.writeMessage = explainError(err, apiBase, claimed);
                    if (claimed) {
                        completeTicket('failed', { error: $scope.writeMessage }).catch(angular.noop);
                    }
                    if (ticketIsSpent(err, claimed)) {
                        clearTicket($window, $location);
                    }
                });
            }

            return {
                restrict: 'E',
                link: link,
                scope: {
                    patient: '=',
                    visitUuid: '=',
                    visitSummary: '=',
                    config: '='
                },
                template: '<ng-include src="contentUrl"/>'
            };
        }]);
