
const moment = require("moment");
const CountyList = require("./src/data/county_gps.json");
const ConfirmedData = require("./src/data/covid_confirmed_usafacts.json");
const DeathData = require("./src/data/covid_death_usafacts.json");
const { linearRegression } = require('simple-statistics');
const ShelterInPlace = require("../data/shelter-in-place/shelter.json");
const USRecovery = require("./src/data/us_recovery.json");

const states = require('us-state-codes');
const fs = require('fs');

function pad(n) { return n < 10 ? '0' + n : n }

const state_fips_to_name =
{
    "10": "Delaware",
    "11": "District of Columbia",
    "12": "Florida",
    "13": "Georgia",
    "15": "Hawaii",
    "16": "Idaho",
    "17": "Illinois",
    "18": "Indiana",
    "19": "Iowa",
    "20": "Kansas",
    "21": "Kentucky",
    "22": "Louisiana",
    "23": "Maine",
    "24": "Maryland",
    "25": "Massachusetts",
    "26": "Michigan",
    "27": "Minnesota",
    "28": "Mississippi",
    "29": "Missouri",
    "30": "Montana",
    "31": "Nebraska",
    "32": "Nevada",
    "33": "New Hampshire",
    "34": "New Jersey",
    "35": "New Mexico",
    "36": "New York",
    "37": "North Carolina",
    "38": "North Dakota",
    "39": "Ohio",
    "40": "Oklahoma",
    "41": "Oregon",
    "42": "Pennsylvania",
    "44": "Rhode Island",
    "45": "South Carolina",
    "46": "South Dakota",
    "47": "Tennessee",
    "48": "Texas",
    "49": "Utah",
    "50": "Vermont",
    "51": "Virginia",
    "53": "Washington",
    "54": "West Virginia",
    "55": "Wisconsin",
    "56": "Wyoming",
    "01": "Alabama",
    "02": "Alaska",
    "04": "Arizona",
    "05": "Arkansas",
    "06": "California",
    "08": "Colorado",
    "09": "Connecticut",
    "72": "Puerto Rico",
    "66": "Guam",
    "78": "Virgin Islands",
    "60": "American Samoa",
    "69": "Northern Mariana Islands",
};

const STATE_Name_To_FIPS = (() => {
    return Object.keys(state_fips_to_name).reduce((m, k) => {
        m[state_fips_to_name[k]] = k
        return m;
    }, {});
})();


let AllData = {};

function getStateNode(state_fips) {
    return AllData[state_fips];
}

function getCountyNode(state_fips, county_fips) {
    let state = getStateNode(state_fips);
    if (!state) {
        AllData[state_fips] = {};
        state = getStateNode(state_fips);
    }
    return state[county_fips];
}

function setCountyNode(state_fips, county_fips, node) {
    let state = getStateNode(state_fips);
    if (!state) {
        AllData[state_fips] = {};
        state = getStateNode(state_fips);
    }

    state[county_fips] = node;
}

const TableLookup = (() => {
    return CountyList.reduce((m, c) => {
        let key = fixCountyFip(c.FIPS);
        m[key] = c;
        return m;
    }, {});
})();

function fix_county_name(county_name, county_fips) {
    let county = TableLookup[county_fips];
    if (!county) {
        if (county_name !== "Statewide Unallocated") {
            console.log(`${county_name} with ${county_fips} doesn't exist`)
        }
        if (county_name != 'St. Louis County') {
            county_name = county_name.replace(/ County$/g, "");
        }
        return county_name;
    }
    return county.County;
}

function createCountyObject(state_fips, state_name, county_fips, county_name) {

    if (county_name === "Grand Princess Cruise Ship") {
        county_fips = "06000";
    }

    let countyObject = {};

    countyObject.CountyName = fix_county_name(county_name, county_fips);
    countyObject.StateName = state_name;
    countyObject.CountyFIPS = county_fips;
    countyObject.StateFIPS = fixStateFips(state_fips);
    countyObject.Confirmed = {};
    countyObject.Death = {};

    /* double check...
    const [s_fips, c_fips] = myFipsCode(countyObject.StateName, countyObject.CountyName);
    if (s_fips !== countyObject.StateFIPS || c_fips !== county_fips) {
        console.log(`bad state county name ${state_name},  ${county_name}`)
        console.log(` ${s_fips},  ${countyObject.StateFIPS}`)
        console.log(s_fips === countyObject.StateFIPS);
        console.log(` ${c_fips},  ${county_fips}`)
        console.log(c_fips === county_fips);
    }
    */

    setCountyNode(state_fips, county_fips, countyObject);

    return countyObject;
}

function fixCountyFip(cp) {
    if (cp.length === 4) {
        return "0" + cp;
    }
    return cp;
}

function fixStateFips(cp) {
    if (!isNaN(cp)) {
        cp = cp.toString();
    }
    if (cp.length === 1) {
        return "0" + cp;
    }
    return cp;
}

// create nodes
ConfirmedData.map(b => {
    if (b.stateFIPS.length === 0) {
        return;
    }
    let countyObject = createCountyObject(
        pad(parseInt(b.stateFIPS)),
        b.State,
        fixCountyFip(b.countyFIPS),
        b["County Name"],
    )
    let county = getCountyNode(countyObject.StateFIPS, countyObject.CountyFIPS);
    if (!county) {
        setCountyNode(countyObject.StateFIPS, countyObject.CountyFIPS, countyObject);
    }
});

function process_USAFACTS() {

    DeathData.map(b => {
        // check for empty line
        if (b.stateFIPS.length === 0) {
            return;
        }
        let countyObject = createCountyObject(
            pad(parseInt(b.stateFIPS)),
            b.State,
            fixCountyFip(b.countyFIPS),
            b["County Name"],
        )
        let county = getCountyNode(countyObject.StateFIPS, countyObject.CountyFIPS);
        if (!county) {
            setCountyNode(countyObject.StateFIPS, countyObject.CountyFIPS, countyObject);
        }
    });

    ConfirmedData.map(b => {
        let county_fips = fixCountyFip(b.countyFIPS);
        let state_fips = pad(parseInt(b.stateFIPS));
        let a = JSON.parse(JSON.stringify(b));
        let county = getCountyNode(state_fips, county_fips);

        delete a["countyFIPS"];
        delete a["County Name"];
        delete a["State"];
        delete a["stateFIPS"];
        delete a["field69"];

        let confirmed = county.Confirmed;
        Object.keys(a).map(k => {
            let v = parseInt(a[k]);
            let p = k.split("/");
            if (p.length != 3) {
                return null;
            }
            let m = pad(parseInt(p[0]));
            let d = pad(parseInt(p[1]));
            let y = p[2];
            confirmed[`${m}/${d}/${y}`] = v;
            return null;
        });
        county.Confirmed = confirmed;
    });

    DeathData.map(b => {
        // check for empty line
        if (b.stateFIPS.length === 0) {
            return;
        }
        let county_fips = fixCountyFip(b.countyFIPS);
        let state_fips = pad(parseInt(b.stateFIPS));
        let a = JSON.parse(JSON.stringify(b));
        let county = getCountyNode(state_fips, county_fips);
        delete a["countyFIPS"];
        delete a["County Name"];
        delete a["State"];
        delete a["stateFIPS"];

        let death = county.Death;
        Object.keys(a).map(k => {
            let v = parseInt(a[k]);
            let p = k.split("/");
            if (p.length != 3) {
                return null;
            }
            let m = pad(parseInt(p[0]));
            let d = pad(parseInt(p[1]));
            let y = p[2];
            death[`${m}/${d}/${y}`] = v;
            return null;
        });
        county.Death = death;
    });
}

function processJHUDataPoint(c, date) {
    let b = c.attributes;
    let county_fips = b.FIPS;
    let state_fips = STATE_Name_To_FIPS[b.Province_State];
    if (county_fips === null && b.Admin2 === "Harris" && b.Province_State === "Texas") {
        county_fips = "48201";
    } else if (county_fips === null) {
        county_fips = "0";
    } else {
        if (county_fips.slice(0, 2) === "90") {
            county_fips = "0"; // until we find a better solution, JHU data change at 4/2
        }
    }
    let county = getCountyNode(state_fips, county_fips);
    if (!county) {
        console.log(c);
        county = createCountyObject(
            state_fips,
            states.getStateCodeByStateName(b.Province_State),
            county_fips,
            b.Admin2,
        )
    }

    let datekey = date;
    county.Confirmed[datekey] = b.Confirmed;
    county.Death[datekey] = b.Deaths;
}

function processJHU(dataset, date) {
    let data = dataset.features;
    for (let i = 0; i < data.length; i++) {
        let datapoint = data[i];
        processJHUDataPoint(datapoint, date);
    }
}

const today = moment().format("MM/DD/YYYY");


// back fill holes in the data

function fillarrayholes(v) {
    let keys = Object.keys(v).sort((a, b) => moment(a, "MM/DD/YYYY").toDate() - moment(b, "MM/DD/YYYY").toDate());
    let key = keys[0];
    while (key !== today) {
        let lastvalue = v[key];
        let nextkey = moment(key, "MM/DD/YYYY").add(1, "days").format("MM/DD/YYYY");
        let nextvalue = v[nextkey];
        if (nextvalue === null || nextvalue === undefined) {
            v[nextkey] = lastvalue;
        }
        key = nextkey;
    }
    return v;
}

function fillholes() {

    for (s in AllData) {
        state = AllData[s];
        for (c in state) {
            let county = state[c];
            county.Confirmed = fillarrayholes(county.Confirmed);
            county.Death = fillarrayholes(county.Death);
            setCountyNode(s, c, county);
        }
    }
}



function getValueFromLastDate(v, comment) {
    if (!v || Object.keys(v).length === 0) {
        return { num: 0, newnum: 0 }
    }
    if (Object.keys(v).length === 1) {
        let ret = {
            num: Object.values(v)[0],
            newnum: Object.values(v)[0],
        }
        return ret;
    }
    let nv = Object.keys(v).sort((a, b) => moment(b, "MM/DD/YYYY").toDate() - moment(a, "MM/DD/YYYY").toDate());

    let last = v[nv[0]]
    let newnum = v[nv[0]] - v[nv[1]];
    if (newnum < 0) {
        newnum = 0;
    }
    return { num: last, newnum: newnum };
}

function mergeTwoMapValues(m1, m2) {
    for (let i in m2) {
        let a = m1[i];
        a = a ? a : 0;
        a += m2[i];
        m1[i] = a;
    }
}


function summarize_counties() {
    for (s in AllData) {
        state = AllData[s];
        for (c in state) {
            county = state[c];
            county.LastConfirmed = 0;
            county.LastDeath = 0;

            const CC = getValueFromLastDate(county.Confirmed, county.CountyName + " " + county.StateName);
            const DD = getValueFromLastDate(county.Death);

            county.LastConfirmed = CC.num;
            county.LastConfirmedNew = CC.newnum;
            county.LastDeath = DD.num;
            county.LastDeathNew = DD.newnum;
            county.DaysToDouble = getDoubleDays(county.Confirmed, c);
            county.DaysToDoubleDeath = getDoubleDays(county.Death, c);
            setCountyNode(s, c, county);
        }
    }
}


// summarize data for states

function summarize_states() {

    for (s in AllData) {
        state = AllData[s];
        // need to 
        Confirmed = {};
        Death = {};
        for (c in state) {
            county = state[c];
            mergeTwoMapValues(Confirmed, county.Confirmed)
            mergeTwoMapValues(Death, county.Death)

        }
        let Summary = {};
        Summary.Confirmed = Confirmed;
        Summary.Death = Death;

        const CC = getValueFromLastDate(Confirmed, s);
        const DD = getValueFromLastDate(Death);

        Summary.LastConfirmed = CC.num;
        Summary.LastConfirmedNew = CC.newnum;
        Summary.LastDeath = DD.num;
        Summary.LastDeathNew = DD.newnum;
        Summary.DaysToDouble = getDoubleDays(Confirmed);
        Summary.DaysToDoubleDeath = getDoubleDays(Death);

        state.Summary = Summary;
    }
}


function summarize_USA() {
    // summarize data for US
    USConfirmed = {};
    USDeath = {};

    for (s in AllData) {
        state = AllData[s];
        mergeTwoMapValues(USConfirmed, state.Summary.Confirmed)
        mergeTwoMapValues(USDeath, state.Summary.Death)
    }

    let Summary = {};
    Summary.Confirmed = USConfirmed;
    Summary.Death = USDeath;

    const CC = getValueFromLastDate(USConfirmed, "country ");
    const DD = getValueFromLastDate(USDeath);

    Summary.LastConfirmed = CC.num;
    Summary.LastConfirmedNew = CC.newnum;
    Summary.LastDeath = DD.num;
    Summary.LastDeathNew = DD.newnum;
    Summary.generated = moment().format();
    Summary.DaysToDouble = getDoubleDays(USConfirmed);
    Summary.DaysToDoubleDeath = getDoubleDays(USDeath);

    AllData.Summary = Summary;
}

function processsShelterInPlace() {
    ShelterInPlace.map(p => {
        let fips = p.CountyFIPS;

        if (fips.length === 2) {
            // state
            //
            if (state_fips_to_name[fips] === p.CountyName) {
                console.log("------------------- good");
            } else {
                console.log(`**************** Mismatch ${p.CountyName} `);
                // console.log("************** url: " + p.Url);
            }
            let state = AllData[fips];
            if (state) {
                state.Summary.StayHomeOrder = {
                    Url: p.Url,
                    StartDate: p.StartDate,
                }
            }

        } else {
            // -- county
            let county = TableLookup[p.CountyFIPS];
            if (county) {
                let state = AllData[fips.slice(0, 2)];
                if (state) {
                    let c = state[fips];
                    if (c) {
                        c.StayHomeOrder = {
                            Url: p.Url,
                            StartDate: p.StartDate,
                        }
                    }
                }
                /*
                if (county.County === p.CountyName) {
                    console.log("------------------- good");
                } else {
                    console.log(`**************** Mismatch ${p.CountyName} ${county.County}`);
                }
                */

            } else {
                console.log("!!!!!!!!!!!!! FIPs not found " + p.CountyFIPS);
            }
        }
    });
}


function getCountyByFips(fips) {
    return AllData[fips.slice(0, 2)][fips];

}
function addMetros() {
    let Metros = {
        BayArea: {
            Name: "SF Bay Area",
            StateFIPS: "06",
            StateName: "CA",
            Counties: [
                "06001",
                "06075",
                "06081",
                "06085",
                "06013",
                "06041",
            ]
        },
    }

    for (m in Metros) {
        let metro = Metros[m];
        Confirmed = {};
        Death = {};

        console.log(metro);

        for (let i = 0; i < metro.Counties.length; i++) {
            let countyfips = metro.Counties[i];
            let county = getCountyByFips(countyfips);

            mergeTwoMapValues(Confirmed, county.Confirmed)
            mergeTwoMapValues(Death, county.Death)

        }
        let Summary = {};
        Summary.Confirmed = Confirmed;
        Summary.Death = Death;

        const CC = getValueFromLastDate(Confirmed, s);
        const DD = getValueFromLastDate(Death);

        Summary.LastConfirmed = CC.num;
        Summary.LastConfirmedNew = CC.newnum;
        Summary.LastDeath = DD.num;
        Summary.LastDeathNew = DD.newnum;

        metro.Summary = Summary;
    }
    AllData.Metros = Metros;
}

function fixdate(k) {
    let p = k.split("/");
    if (p.length != 3) {
        return null;
    }
    let m = pad(parseInt(p[0]));
    let d = pad(parseInt(p[1]));
    let y = p[2];
    if (y.length === 2) {
        y = "20" + y;
    }
    return `${m}/${d}/${y}`;
}

function addUSRecovery() {

    let Recovered = {};
    for (i in USRecovery) {
        if (i === "Province/State" || i === 'Country/Region' || i === 'Lat' || i === 'Long') {
            continue;
        }
        let k = fixdate(i);
        Recovered[k] = parseInt(USRecovery[i]);
    }

    // AllData.Summary.Recovered = Recovered;
    AllData.Summary.Recovered = fillarrayholes(Recovered);
    const RR = getValueFromLastDate(Recovered, s);
    AllData.Summary.LastRecovered = RR.num;
    AllData.Summary.LastRecoveredNew = RR.newnum;
}

const log2 = (a) => Math.log(a) / Math.log(2);

function getDoubleDays(data, fips) {
    let keys = Object.keys(data).sort((a, b) => moment(a, "MM/DD/YYYY").toDate() - moment(b, "MM/DD/YYYY").toDate());
    if (keys.length < 8) {
        return null;
    }
    const key7days = keys.slice(-8, -1);
    const firstday = moment(key7days[0], "MM/DD/YYYY");

    const prepared_data = key7days.map(k => {
        let delta = moment(k, "MM/DD/YYYY").diff(firstday, "days");
        return [delta, log2(data[k])];
    })
    if (prepared_data[0][1] <= log2(10)) { // number too small tomake predictions
        return null;
    }
    const { m, b } = linearRegression(prepared_data);
    return 1 / m;
}

function processAllJHU() {

    for (let d = moment("03/25/2020", "MM/DD/YYYY"); d.isBefore(moment()); d = d.add(1, "days")) {
        let file = `../data/archive/JHU-${d.format("MM-DD-YYYY")}.json`;
        let contents = fs.readFileSync(file);
        let data = JSON.parse(contents);

        console.log("processing JHU " + d.format("MM/DD/YYYY"));
        processJHU(data, d.format("MM/DD/YYYY"));
    }
}

function processBNO(dataset, date) {
    let data = dataset;
    for (let i = 0; i < data.length; i++) {
        let datapoint = data[i];
        // console.log(datapoint);
        let state_name = datapoint["UNITED STATES"];
        let state_fips = STATE_Name_To_FIPS[state_name];
        if (!state_fips) {
            console.log("can't find state fips for " + state_name);
            continue;
        }

        if (AllData[state_fips]) {

            let Recovered = AllData[state_fips].Summary.Recovered;
            if (!Recovered) {
                Recovered = {};
            }
            let recovery_number = parseInt(datapoint.Recovered.replace(/,/g, ""));
            if (recovery_number !== null && !isNaN(recovery_number)) {
                Recovered[date] = recovery_number;
                console.log("Recovery for " + state_name + " is " + recovery_number)
            }
            AllData[state_fips].Summary.Recovered = Recovered;
            const RR = getValueFromLastDate(Recovered, "debug");
            AllData[state_fips].Summary.LastRecovered = RR.num;
            AllData[state_fips].Summary.LastRecoveredNew = RR.newnum;
        } else {
            console.log("FIXME: no state node for " + state_name);
        }
    }
}

function addStateRecovery() {
    for (let d = moment("04/02/2020", "MM/DD/YYYY"); d.isBefore(moment()); d = d.add(1, "days")) {
        let file = `../data/archive/BNO-${d.format("MM-DD-YYYY")}.json`;
        let contents = fs.readFileSync(file);
        let data = JSON.parse(contents);
        console.log("Processing BNO " + d.format("MM/DD/YYYY"));
        processBNO(data, d.format("MM/DD/YYYY"));
    }
}

process_USAFACTS();
processAllJHU();

fillholes();

summarize_counties();
summarize_states();
summarize_USA();
addMetros();

processsShelterInPlace();
addUSRecovery();
addStateRecovery();

let content = JSON.stringify(AllData, 2, 2);
fs.writeFileSync("./src/data/AllData.json", content);
