const log = require("debug")("powpow:send");
const axios = require('axios')


export function sendtx(txhash) {
    return new Promise((resolve, reject) => {
        axios.post('https://api.whatsonchain.com/v1/bsv/main/tx/raw', {
            txhex: txhash
        }).then(response => {
            if (response.status === 200) {
                resolve(response.data);
            } else {
                log(`error while sending txhash ${txhash}, resonse was ${response.status}`);
                reject(null);
            }
        }).catch(e => {
            log(`error while sending txhash ${txhash}, error ${e.message} / ${e.response.data}`);
            reject(null);
        });
    });
}

// TODO: finish implementing
export function bulksendtx(hashes) {
    return new Promise((resolve, reject) => {
        axios.post('https://api.whatsonchain.com/v1/bsv/main/tx/broadcast?feedback=true', hashes).then(response => {
            if (response.status === 200) {
                resolve(response.data);
            } else {
                log(`error while sending txhash ${txhash}, resonse was ${response.status}`);
                reject(null);
            }
        }).catch(e => {
            log(`error while sending txhash ${txhash}, error ${e.message} / ${e.response.data}`);
            reject(null);
        });
    });
}
