/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */


/**
 * Controller for time zone fields. Time zone fields use IANA time zone
 * database identifiers as the standard representation for each supported time
 * zone. These identifiers are also legal Java time zone IDs.
 */
angular.module('form').controller('timeZoneFieldController', ['$scope', '$injector',
    function timeZoneFieldController($scope, $injector) {

    /**
     * Map of time zone regions to the map of all time zone name/ID pairs
     * within those regions.
     *
     * @type Object.<String, Object.<String, String>>
     */
    $scope.timeZones = {

        "Africa" : {
            "Abidjan"       : "Africa/Abidjan",
            "Accra"         : "Africa/Accra",
            "Addis Ababa"   : "Africa/Addis_Ababa",
            "Algiers"       : "Africa/Algiers",
            "Asmara"        : "Africa/Asmara",
            "Asmera"        : "Africa/Asmera",
            "Bamako"        : "Africa/Bamako",
            "Bangui"        : "Africa/Bangui",
            "Banjul"        : "Africa/Banjul",
            "Bissau"        : "Africa/Bissau",
            "Blantyre"      : "Africa/Blantyre",
            "Brazzaville"   : "Africa/Brazzaville",
            "Bujumbura"     : "Africa/Bujumbura",
            "Cairo"         : "Africa/Cairo",
            "Casablanca"    : "Africa/Casablanca",
            "Ceuta"         : "Africa/Ceuta",
            "Conakry"       : "Africa/Conakry",
            "Dakar"         : "Africa/Dakar",
            "Dar es Salaam" : "Africa/Dar_es_Salaam",
            "Djibouti"      : "Africa/Djibouti",
            "Douala"        : "Africa/Douala",
            "El Aaiun"      : "Africa/El_Aaiun",
            "Freetown"      : "Africa/Freetown",
            "Gaborone"      : "Africa/Gaborone",
            "Harare"        : "Africa/Harare",
            "Johannesburg"  : "Africa/Johannesburg",
            "Juba"          : "Africa/Juba",
            "Kampala"       : "Africa/Kampala",
            "Khartoum"      : "Africa/Khartoum",
            "Kigali"        : "Africa/Kigali",
            "Kinshasa"      : "Africa/Kinshasa",
            "Lagos"         : "Africa/Lagos",
            "Libreville"    : "Africa/Libreville",
            "Lome"          : "Africa/Lome",
            "Luanda"        : "Africa/Luanda",
            "Lubumbashi"    : "Africa/Lubumbashi",
            "Lusaka"        : "Africa/Lusaka",
            "Malabo"        : "Africa/Malabo",
            "Maputo"        : "Africa/Maputo",
            "Maseru"        : "Africa/Maseru",
            "Mbabane"       : "Africa/Mbabane",
            "Mogadishu"     : "Africa/Mogadishu",
            "Monrovia"      : "Africa/Monrovia",
            "Nairobi"       : "Africa/Nairobi",
            "Ndjamena"      : "Africa/Ndjamena",
            "Niamey"        : "Africa/Niamey",
            "Nouakchott"    : "Africa/Nouakchott",
            "Ouagadougou"   : "Africa/Ouagadougou",
            "Porto-Novo"    : "Africa/Porto-Novo",
            "Sao Tome"      : "Africa/Sao_Tome",
            "Timbuktu"      : "Africa/Timbuktu",
            "Tripoli"       : "Africa/Tripoli",
            "Tunis"         : "Africa/Tunis",
            "Windhoek"      : "Africa/Windhoek"
        },

        "America" : {
            "Adak"                           : "America/Adak",
            "Anchorage"                      : "America/Anchorage",
            "Anguilla"                       : "America/Anguilla",
            "Antigua"                        : "America/Antigua",
            "Araguaina"                      : "America/Araguaina",
            "Argentina / Buenos Aires"       : "America/Argentina/Buenos_Aires",
            "Argentina / Catamarca"          : "America/Argentina/Catamarca",
            "Argentina / Comodoro Rivadavia" : "America/Argentina/ComodRivadavia",
            "Argentina / Cordoba"            : "America/Argentina/Cordoba",
            "Argentina / Jujuy"              : "America/Argentina/Jujuy",
            "Argentina / La Rioja"           : "America/Argentina/La_Rioja",
            "Argentina / Mendoza"            : "America/Argentina/Mendoza",
            "Argentina / Rio Gallegos"       : "America/Argentina/Rio_Gallegos",
            "Argentina / Salta"              : "America/Argentina/Salta",
            "Argentina / San Juan"           : "America/Argentina/San_Juan",
            "Argentina / San Luis"           : "America/Argentina/San_Luis",
            "Argentina / Tucuman"            : "America/Argentina/Tucuman",
            "Argentina / Ushuaia"            : "America/Argentina/Ushuaia",
            "Aruba"                          : "America/Aruba",
            "Asuncion"                       : "America/Asuncion",
            "Atikokan"                       : "America/Atikokan",
            "Atka"                           : "America/Atka",
            "Bahia"                          : "America/Bahia",
            "Bahia Banderas"                 : "America/Bahia_Banderas",
            "Barbados"                       : "America/Barbados",
            "Belem"                          : "America/Belem",
            "Belize"                         : "America/Belize",
            "Blanc-Sablon"                   : "America/Blanc-Sablon",
            "Boa Vista"                      : "America/Boa_Vista",
            "Bogota"                         : "America/Bogota",
            "Boise"                          : "America/Boise",
            "Buenos Aires"                   : "America/Buenos_Aires",
            "Cambridge Bay"                  : "America/Cambridge_Bay",
            "Campo Grande"                   : "America/Campo_Grande",
            "Cancun"                         : "America/Cancun",
            "Caracas"                        : "America/Caracas",
            "Catamarca"                      : "America/Catamarca",
            "Cayenne"                        : "America/Cayenne",
            "Cayman"                         : "America/Cayman",
            "Chicago"                        : "America/Chicago",
            "Chihuahua"                      : "America/Chihuahua",
            "Coral Harbour"                  : "America/Coral_Harbour",
            "Cordoba"                        : "America/Cordoba",
            "Costa Rica"                     : "America/Costa_Rica",
            "Creston"                        : "America/Creston",
            "Cuiaba"                         : "America/Cuiaba",
            "Curacao"                        : "America/Curacao",
            "Danmarkshavn"                   : "America/Danmarkshavn",
            "Dawson"                         : "America/Dawson",
            "Dawson Creek"                   : "America/Dawson_Creek",
            "Denver"                         : "America/Denver",
            "Detroit"                        : "America/Detroit",
            "Dominica"                       : "America/Dominica",
            "Edmonton"                       : "America/Edmonton",
            "Eirunepe"                       : "America/Eirunepe",
            "El Salvador"                    : "America/El_Salvador",
            "Ensenada"                       : "America/Ensenada",
            "Fort Wayne"                     : "America/Fort_Wayne",
            "Fortaleza"                      : "America/Fortaleza",
            "Glace Bay"                      : "America/Glace_Bay",
            "Godthab"                        : "America/Godthab",
            "Goose Bay"                      : "America/Goose_Bay",
            "Grand Turk"                     : "America/Grand_Turk",
            "Grenada"                        : "America/Grenada",
            "Guadeloupe"                     : "America/Guadeloupe",
            "Guatemala"                      : "America/Guatemala",
            "Guayaquil"                      : "America/Guayaquil",
            "Guyana"                         : "America/Guyana",
            "Halifax"                        : "America/Halifax",
            "Havana"                         : "America/Havana",
            "Hermosillo"                     : "America/Hermosillo",
            "Indiana / Indianapolis"         : "America/Indiana/Indianapolis",
            "Indiana / Knox"                 : "America/Indiana/Knox",
            "Indiana / Marengo"              : "America/Indiana/Marengo",
            "Indiana / Petersburg"           : "America/Indiana/Petersburg",
            "Indiana / Tell City"            : "America/Indiana/Tell_City",
            "Indiana / Vevay"                : "America/Indiana/Vevay",
            "Indiana / Vincennes"            : "America/Indiana/Vincennes",
            "Indiana / Winamac"              : "America/Indiana/Winamac",
            "Indianapolis"                   : "America/Indianapolis",
            "Inuvik"                         : "America/Inuvik",
            "Iqaluit"                        : "America/Iqaluit",
            "Jamaica"                        : "America/Jamaica",
            "Jujuy"                          : "America/Jujuy",
            "Juneau"                         : "America/Juneau",
            "Kentucky / Louisville"          : "America/Kentucky/Louisville",
            "Kentucky / Monticello"          : "America/Kentucky/Monticello",
            "Kralendijk"                     : "America/Kralendijk",
            "La Paz"                         : "America/La_Paz",
            "Lima"                           : "America/Lima",
            "Los Angeles"                    : "America/Los_Angeles",
            "Louisville"                     : "America/Louisville",
            "Lower Princes"                  : "America/Lower_Princes",
            "Maceio"                         : "America/Maceio",
            "Managua"                        : "America/Managua",
            "Manaus"                         : "America/Manaus",
            "Marigot"                        : "America/Marigot",
            "Martinique"                     : "America/Martinique",
            "Matamoros"                      : "America/Matamoros",
            "Mazatlan"                       : "America/Mazatlan",
            "Mendoza"                        : "America/Mendoza",
            "Menominee"                      : "America/Menominee",
            "Merida"                         : "America/Merida",
            "Metlakatla"                     : "America/Metlakatla",
            "Mexico City"                    : "America/Mexico_City",
            "Miquelon"                       : "America/Miquelon",
            "Moncton"                        : "America/Moncton",
            "Monterrey"                      : "America/Monterrey",
            "Montevideo"                     : "America/Montevideo",
            "Montreal"                       : "America/Montreal",
            "Montserrat"                     : "America/Montserrat",
            "Nassau"                         : "America/Nassau",
            "New York"                       : "America/New_York",
            "Nipigon"                        : "America/Nipigon",
            "Nome"                           : "America/Nome",
            "Noronha"                        : "America/Noronha",
            "North Dakota / Beulah"          : "America/North_Dakota/Beulah",
            "North Dakota / Center"          : "America/North_Dakota/Center",
            "North Dakota / New Salem"       : "America/North_Dakota/New_Salem",
            "Ojinaga"                        : "America/Ojinaga",
            "Panama"                         : "America/Panama",
            "Pangnirtung"                    : "America/Pangnirtung",
            "Paramaribo"                     : "America/Paramaribo",
            "Phoenix"                        : "America/Phoenix",
            "Port-au-Prince"                 : "America/Port-au-Prince",
            "Port of Spain"                  : "America/Port_of_Spain",
            "Porto Acre"                     : "America/Porto_Acre",
            "Porto Velho"                    : "America/Porto_Velho",
            "Puerto Rico"                    : "America/Puerto_Rico",
            "Rainy River"                    : "America/Rainy_River",
            "Rankin Inlet"                   : "America/Rankin_Inlet",
            "Recife"                         : "America/Recife",
            "Regina"                         : "America/Regina",
            "Resolute"                       : "America/Resolute",
            "Rio Branco"                     : "America/Rio_Branco",
            "Rosario"                        : "America/Rosario",
            "Santa Isabel"                   : "America/Santa_Isabel",
            "Santarem"                       : "America/Santarem",
            "Santiago"                       : "America/Santiago",
            "Santo Domingo"                  : "America/Santo_Domingo",
            "Sao Paulo"                      : "America/Sao_Paulo",
            "Scoresbysund"                   : "America/Scoresbysund",
            "Shiprock"                       : "America/Shiprock",
            "Sitka"                          : "America/Sitka",
            "St. Barthelemy"                 : "America/St_Barthelemy",
            "St. Johns"                      : "America/St_Johns",
            "St. Kitts"                      : "America/St_Kitts",
            "St. Lucia"                      : "America/St_Lucia",
            "St. Thomas"                     : "America/St_Thomas",
            "St. Vincent"                    : "America/St_Vincent",
            "Swift Current"                  : "America/Swift_Current",
            "Tegucigalpa"                    : "America/Tegucigalpa",
            "Thule"                          : "America/Thule",
            "Thunder Bay"                    : "America/Thunder_Bay",
            "Tijuana"                        : "America/Tijuana",
            "Toronto"                        : "America/Toronto",
            "Tortola"                        : "America/Tortola",
            "Vancouver"                      : "America/Vancouver",
            "Virgin"                         : "America/Virgin",
            "Whitehorse"                     : "America/Whitehorse",
            "Winnipeg"                       : "America/Winnipeg",
            "Yakutat"                        : "America/Yakutat",
            "Yellowknife"                    : "America/Yellowknife"
        },

        "Antarctica" : {
            "Casey"            : "Antarctica/Casey",
            "Davis"            : "Antarctica/Davis",
            "Dumont d'Urville" : "Antarctica/DumontDUrville",
            "Macquarie"        : "Antarctica/Macquarie",
            "Mawson"           : "Antarctica/Mawson",
            "McMurdo"          : "Antarctica/McMurdo",
            "Palmer"           : "Antarctica/Palmer",
            "Rothera"          : "Antarctica/Rothera",
            "South Pole"       : "Antarctica/South_Pole",
            "Syowa"            : "Antarctica/Syowa",
            "Troll"            : "Antarctica/Troll",
            "Vostok"           : "Antarctica/Vostok"
        },

        "Arctic" : {
            "Longyearbyen" : "Arctic/Longyearbyen"
        },

        "Asia" : {
            "Aden"          : "Asia/Aden",
            "Almaty"        : "Asia/Almaty",
            "Amman"         : "Asia/Amman",
            "Anadyr"        : "Asia/Anadyr",
            "Aqtau"         : "Asia/Aqtau",
            "Aqtobe"        : "Asia/Aqtobe",
            "Ashgabat"      : "Asia/Ashgabat",
            "Ashkhabad"     : "Asia/Ashkhabad",
            "Baghdad"       : "Asia/Baghdad",
            "Bahrain"       : "Asia/Bahrain",
            "Baku"          : "Asia/Baku",
            "Bangkok"       : "Asia/Bangkok",
            "Beirut"        : "Asia/Beirut",
            "Bishkek"       : "Asia/Bishkek",
            "Brunei"        : "Asia/Brunei",
            "Calcutta"      : "Asia/Calcutta",
            "Chita"         : "Asia/Chita",
            "Choibalsan"    : "Asia/Choibalsan",
            "Chongqing"     : "Asia/Chongqing",
            "Colombo"       : "Asia/Colombo",
            "Dacca"         : "Asia/Dacca",
            "Damascus"      : "Asia/Damascus",
            "Dhaka"         : "Asia/Dhaka",
            "Dili"          : "Asia/Dili",
            "Dubai"         : "Asia/Dubai",
            "Dushanbe"      : "Asia/Dushanbe",
            "Gaza"          : "Asia/Gaza",
            "Harbin"        : "Asia/Harbin",
            "Hebron"        : "Asia/Hebron",
            "Ho Chi Minh"   : "Asia/Ho_Chi_Minh",
            "Hong Kong"     : "Asia/Hong_Kong",
            "Hovd"          : "Asia/Hovd",
            "Irkutsk"       : "Asia/Irkutsk",
            "Istanbul"      : "Asia/Istanbul",
            "Jakarta"       : "Asia/Jakarta",
            "Jayapura"      : "Asia/Jayapura",
            "Jerusalem"     : "Asia/Jerusalem",
            "Kabul"         : "Asia/Kabul",
            "Kamchatka"     : "Asia/Kamchatka",
            "Karachi"       : "Asia/Karachi",
            "Kashgar"       : "Asia/Kashgar",
            "Kathmandu"     : "Asia/Kathmandu",
            "Katmandu"      : "Asia/Katmandu",
            "Khandyga"      : "Asia/Khandyga",
            "Kolkata"       : "Asia/Kolkata",
            "Krasnoyarsk"   : "Asia/Krasnoyarsk",
            "Kuala Lumpur"  : "Asia/Kuala_Lumpur",
            "Kuching"       : "Asia/Kuching",
            "Kuwait"        : "Asia/Kuwait",
            "Macao"         : "Asia/Macao",
            "Macau"         : "Asia/Macau",
            "Magadan"       : "Asia/Magadan",
            "Makassar"      : "Asia/Makassar",
            "Manila"        : "Asia/Manila",
            "Muscat"        : "Asia/Muscat",
            "Nicosia"       : "Asia/Nicosia",
            "Novokuznetsk"  : "Asia/Novokuznetsk",
            "Novosibirsk"   : "Asia/Novosibirsk",
            "Omsk"          : "Asia/Omsk",
            "Oral"          : "Asia/Oral",
            "Phnom Penh"    : "Asia/Phnom_Penh",
            "Pontianak"     : "Asia/Pontianak",
            "Pyongyang"     : "Asia/Pyongyang",
            "Qatar"         : "Asia/Qatar",
            "Qyzylorda"     : "Asia/Qyzylorda",
            "Rangoon"       : "Asia/Rangoon",
            "Riyadh"        : "Asia/Riyadh",
            "Saigon"        : "Asia/Saigon",
            "Sakhalin"      : "Asia/Sakhalin",
            "Samarkand"     : "Asia/Samarkand",
            "Seoul"         : "Asia/Seoul",
            "Shanghai"      : "Asia/Shanghai",
            "Singapore"     : "Asia/Singapore",
            "Srednekolymsk" : "Asia/Srednekolymsk",
            "Taipei"        : "Asia/Taipei",
            "Tashkent"      : "Asia/Tashkent",
            "Tbilisi"       : "Asia/Tbilisi",
            "Tehran"        : "Asia/Tehran",
            "Tel Aviv"      : "Asia/Tel_Aviv",
            "Thimbu"        : "Asia/Thimbu",
            "Thimphu"       : "Asia/Thimphu",
            "Tokyo"         : "Asia/Tokyo",
            "Ujung Pandang" : "Asia/Ujung_Pandang",
            "Ulaanbaatar"   : "Asia/Ulaanbaatar",
            "Ulan Bator"    : "Asia/Ulan_Bator",
            "Urumqi"        : "Asia/Urumqi",
            "Ust-Nera"      : "Asia/Ust-Nera",
            "Vientiane"     : "Asia/Vientiane",
            "Vladivostok"   : "Asia/Vladivostok",
            "Yakutsk"       : "Asia/Yakutsk",
            "Yekaterinburg" : "Asia/Yekaterinburg",
            "Yerevan"       : "Asia/Yerevan"
        },

        "Atlantic" : {
            "Azores"        : "Atlantic/Azores",
            "Bermuda"       : "Atlantic/Bermuda",
            "Canary"        : "Atlantic/Canary",
            "Cape Verde"    : "Atlantic/Cape_Verde",
            "Faeroe"        : "Atlantic/Faeroe",
            "Faroe"         : "Atlantic/Faroe",
            "Jan Mayen"     : "Atlantic/Jan_Mayen",
            "Madeira"       : "Atlantic/Madeira",
            "Reykjavik"     : "Atlantic/Reykjavik",
            "South Georgia" : "Atlantic/South_Georgia",
            "St. Helena"    : "Atlantic/St_Helena",
            "Stanley"       : "Atlantic/Stanley"
        },

        "Australia" : {
            "Adelaide"    : "Australia/Adelaide",
            "Brisbane"    : "Australia/Brisbane",
            "Broken Hill" : "Australia/Broken_Hill",
            "Canberra"    : "Australia/Canberra",
            "Currie"      : "Australia/Currie",
            "Darwin"      : "Australia/Darwin",
            "Eucla"       : "Australia/Eucla",
            "Hobart"      : "Australia/Hobart",
            "Lindeman"    : "Australia/Lindeman",
            "Lord Howe"   : "Australia/Lord_Howe",
            "Melbourne"   : "Australia/Melbourne",
            "North"       : "Australia/North",
            "Perth"       : "Australia/Perth",
            "Queensland"  : "Australia/Queensland",
            "South"       : "Australia/South",
            "Sydney"      : "Australia/Sydney",
            "Tasmania"    : "Australia/Tasmania",
            "Victoria"    : "Australia/Victoria",
            "West"        : "Australia/West",
            "Yancowinna"  : "Australia/Yancowinna"
        },

        "Brazil" : {
            "Acre"                : "Brazil/Acre",
            "Fernando de Noronha" : "Brazil/DeNoronha",
            "East"                : "Brazil/East",
            "West"                : "Brazil/West"
        },

        "Canada" : {
            "Atlantic"          : "Canada/Atlantic",
            "Central"           : "Canada/Central",
            "Eastern"           : "Canada/Eastern",
            "Mountain"          : "Canada/Mountain",
            "Newfoundland"      : "Canada/Newfoundland",
            "Pacific"           : "Canada/Pacific",
            "Saskatchewan"      : "Canada/Saskatchewan",
            "Yukon"             : "Canada/Yukon"
        },

        "Chile" : {
            "Continental"   : "Chile/Continental",
            "Easter Island" : "Chile/EasterIsland"
        },

        "Europe" : {
            "Amsterdam"   : "Europe/Amsterdam",
            "Andorra"     : "Europe/Andorra",
            "Athens"      : "Europe/Athens",
            "Belfast"     : "Europe/Belfast",
            "Belgrade"    : "Europe/Belgrade",
            "Berlin"      : "Europe/Berlin",
            "Bratislava"  : "Europe/Bratislava",
            "Brussels"    : "Europe/Brussels",
            "Bucharest"   : "Europe/Bucharest",
            "Budapest"    : "Europe/Budapest",
            "Busingen"    : "Europe/Busingen",
            "Chisinau"    : "Europe/Chisinau",
            "Copenhagen"  : "Europe/Copenhagen",
            "Dublin"      : "Europe/Dublin",
            "Gibraltar"   : "Europe/Gibraltar",
            "Guernsey"    : "Europe/Guernsey",
            "Helsinki"    : "Europe/Helsinki",
            "Isle of Man" : "Europe/Isle_of_Man",
            "Istanbul"    : "Europe/Istanbul",
            "Jersey"      : "Europe/Jersey",
            "Kaliningrad" : "Europe/Kaliningrad",
            "Kiev"        : "Europe/Kiev",
            "Lisbon"      : "Europe/Lisbon",
            "Ljubljana"   : "Europe/Ljubljana",
            "London"      : "Europe/London",
            "Luxembourg"  : "Europe/Luxembourg",
            "Madrid"      : "Europe/Madrid",
            "Malta"       : "Europe/Malta",
            "Mariehamn"   : "Europe/Mariehamn",
            "Minsk"       : "Europe/Minsk",
            "Monaco"      : "Europe/Monaco",
            "Moscow"      : "Europe/Moscow",
            "Nicosia"     : "Europe/Nicosia",
            "Oslo"        : "Europe/Oslo",
            "Paris"       : "Europe/Paris",
            "Podgorica"   : "Europe/Podgorica",
            "Prague"      : "Europe/Prague",
            "Riga"        : "Europe/Riga",
            "Rome"        : "Europe/Rome",
            "Samara"      : "Europe/Samara",
            "San Marino"  : "Europe/San_Marino",
            "Sarajevo"    : "Europe/Sarajevo",
            "Simferopol"  : "Europe/Simferopol",
            "Skopje"      : "Europe/Skopje",
            "Sofia"       : "Europe/Sofia",
            "Stockholm"   : "Europe/Stockholm",
            "Tallinn"     : "Europe/Tallinn",
            "Tirane"      : "Europe/Tirane",
            "Tiraspol"    : "Europe/Tiraspol",
            "Uzhgorod"    : "Europe/Uzhgorod",
            "Vaduz"       : "Europe/Vaduz",
            "Vatican"     : "Europe/Vatican",
            "Vienna"      : "Europe/Vienna",
            "Vilnius"     : "Europe/Vilnius",
            "Volgograd"   : "Europe/Volgograd",
            "Warsaw"      : "Europe/Warsaw",
            "Zagreb"      : "Europe/Zagreb",
            "Zaporozhye"  : "Europe/Zaporozhye",
            "Zurich"      : "Europe/Zurich"
        },

        "GMT" : {
            "GMT-14" : "Etc/GMT-14",
            "GMT-13" : "Etc/GMT-13",
            "GMT-12" : "Etc/GMT-12",
            "GMT-11" : "Etc/GMT-11",
            "GMT-10" : "Etc/GMT-10",
            "GMT-9"  : "Etc/GMT-9",
            "GMT-8"  : "Etc/GMT-8",
            "GMT-7"  : "Etc/GMT-7",
            "GMT-6"  : "Etc/GMT-6",
            "GMT-5"  : "Etc/GMT-5",
            "GMT-4"  : "Etc/GMT-4",
            "GMT-3"  : "Etc/GMT-3",
            "GMT-2"  : "Etc/GMT-2",
            "GMT-1"  : "Etc/GMT-1",
            "GMT+0"  : "Etc/GMT+0",
            "GMT+1"  : "Etc/GMT+1",
            "GMT+2"  : "Etc/GMT+2",
            "GMT+3"  : "Etc/GMT+3",
            "GMT+4"  : "Etc/GMT+4",
            "GMT+5"  : "Etc/GMT+5",
            "GMT+6"  : "Etc/GMT+6",
            "GMT+7"  : "Etc/GMT+7",
            "GMT+8"  : "Etc/GMT+8",
            "GMT+9"  : "Etc/GMT+9",
            "GMT+10" : "Etc/GMT+10",
            "GMT+11" : "Etc/GMT+11",
            "GMT+12" : "Etc/GMT+12"
        },

        "Indian" : {
            "Antananarivo" : "Indian/Antananarivo",
            "Chagos"       : "Indian/Chagos",
            "Christmas"    : "Indian/Christmas",
            "Cocos"        : "Indian/Cocos",
            "Comoro"       : "Indian/Comoro",
            "Kerguelen"    : "Indian/Kerguelen",
            "Mahe"         : "Indian/Mahe",
            "Maldives"     : "Indian/Maldives",
            "Mauritius"    : "Indian/Mauritius",
            "Mayotte"      : "Indian/Mayotte",
            "Reunion"      : "Indian/Reunion"
        },

        "Mexico" : {
            "Baja Norte" : "Mexico/BajaNorte",
            "Baja Sur"   : "Mexico/BajaSur",
            "General"    : "Mexico/General"
        },

        "Pacific" : {
            "Apia"         : "Pacific/Apia",
            "Auckland"     : "Pacific/Auckland",
            "Bougainville" : "Pacific/Bougainville",
            "Chatham"      : "Pacific/Chatham",
            "Chuuk"        : "Pacific/Chuuk",
            "Easter"       : "Pacific/Easter",
            "Efate"        : "Pacific/Efate",
            "Enderbury"    : "Pacific/Enderbury",
            "Fakaofo"      : "Pacific/Fakaofo",
            "Fiji"         : "Pacific/Fiji",
            "Funafuti"     : "Pacific/Funafuti",
            "Galapagos"    : "Pacific/Galapagos",
            "Gambier"      : "Pacific/Gambier",
            "Guadalcanal"  : "Pacific/Guadalcanal",
            "Guam"         : "Pacific/Guam",
            "Honolulu"     : "Pacific/Honolulu",
            "Johnston"     : "Pacific/Johnston",
            "Kiritimati"   : "Pacific/Kiritimati",
            "Kosrae"       : "Pacific/Kosrae",
            "Kwajalein"    : "Pacific/Kwajalein",
            "Majuro"       : "Pacific/Majuro",
            "Marquesas"    : "Pacific/Marquesas",
            "Midway"       : "Pacific/Midway",
            "Nauru"        : "Pacific/Nauru",
            "Niue"         : "Pacific/Niue",
            "Norfolk"      : "Pacific/Norfolk",
            "Noumea"       : "Pacific/Noumea",
            "Pago Pago"    : "Pacific/Pago_Pago",
            "Palau"        : "Pacific/Palau",
            "Pitcairn"     : "Pacific/Pitcairn",
            "Pohnpei"      : "Pacific/Pohnpei",
            "Ponape"       : "Pacific/Ponape",
            "Port Moresby" : "Pacific/Port_Moresby",
            "Rarotonga"    : "Pacific/Rarotonga",
            "Saipan"       : "Pacific/Saipan",
            "Samoa"        : "Pacific/Samoa",
            "Tahiti"       : "Pacific/Tahiti",
            "Tarawa"       : "Pacific/Tarawa",
            "Tongatapu"    : "Pacific/Tongatapu",
            "Truk"         : "Pacific/Truk",
            "Wake"         : "Pacific/Wake",
            "Wallis"       : "Pacific/Wallis",
            "Yap"          : "Pacific/Yap"
        }

    };

    /**
     * All selectable regions.
     *
     * @type String[]
     */
    $scope.regions = (function collectRegions() {

        // Start with blank entry
        var regions = [ '' ];

        // Add each available region
        for (var region in $scope.timeZones)
            regions.push(region);

        return regions;

    })();

    /**
     * Direct mapping of all time zone IDs to the region containing that ID.
     *
     * @type Object.<String, String>
     */
    var timeZoneRegions = (function mapRegions() {

        var regions = {};

        // For each available region
        for (var region in $scope.timeZones) {

            // Get time zones within that region
            var timeZonesInRegion = $scope.timeZones[region];

            // For each of those time zones
            for (var timeZoneName in timeZonesInRegion) {

                // Get corresponding ID
                var timeZoneID = timeZonesInRegion[timeZoneName];

                // Store region in map
                regions[timeZoneID] = region;

            }

        }

        return regions;

    })();

    /**
     * Map of regions to the currently selected time zone for that region.
     * Initially, all regions will be set to default selections (the first
     * time zone, sorted lexicographically).
     *
     * @type Object.<String, String>
     */
    var selectedTimeZone = (function produceDefaultTimeZones() {

        var defaultTimeZone = {};

        // For each available region
        for (var region in $scope.timeZones) {

            // Get time zones within that region
            var timeZonesInRegion = $scope.timeZones[region];

            // No default initially
            var defaultZoneName = null;
            var defaultZoneID = null;

            // For each of those time zones
            for (var timeZoneName in timeZonesInRegion) {

                // Get corresponding ID
                var timeZoneID = timeZonesInRegion[timeZoneName];

                // Set as default if earlier than existing default
                if (!defaultZoneName || timeZoneName < defaultZoneName) {
                    defaultZoneName = timeZoneName;
                    defaultZoneID = timeZoneID;
                }

            }

            // Store default zone
            defaultTimeZone[region] = defaultZoneID;

        }

        return defaultTimeZone;

    })();

    /**
     * The name of the region currently selected. The selected region narrows
     * which time zones are selectable.
     *
     * @type String
     */
    $scope.region = '';

    // Ensure corresponding region is selected
    $scope.$watch('model', function setModel(model) {
        $scope.region = timeZoneRegions[model] || '';
        selectedTimeZone[$scope.region] = model;
    });

    // Restore time zone selection when region changes
    $scope.$watch('region', function restoreSelection(region) {
        $scope.model = selectedTimeZone[region] || null;
    });

}]);
