'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var qrcode = _interopDefault(require('qrcode-terminal'));
var program = _interopDefault(require('commander'));
var bsv$1 = _interopDefault(require('bsv'));
var fs = _interopDefault(require('fs'));
var path = _interopDefault(require('path'));

const log = require("debug")("powpow:send");
const axios = require('axios');


function sendtx(txhash) {
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

const log$1 = require("debug")("powpow:utxos");

const bitindex = require('bitindex-sdk').instance();

async function utxos(address) {
    log$1(`fetching utxos for address ${address}`);
    const utxos = await bitindex.address.getUtxos(address);
    const sorted = utxos.sort((a, b) => {
        if (a.satoshis > b.satoshis) { return 1 }
        if (a.satoshis < b.satoshis) { return -1 }
        return 0;
    });
    return sorted;
}

const bitindex$1 = require('bitindex-sdk').instance();

function estimateFeeForScript(script, satoshis=0, feeb=0.6) {

    function getDummyUTXO() {
        return bsv$1.Transaction.UnspentOutput({
            address: '19dCWu1pvak7cgw5b1nFQn9LapFSQLqahC',
            txId: 'e29bc8d6c7298e524756ac116bd3fb5355eec1da94666253c3f40810a4000804',
            outputIndex: 0,
            satoshis: 5000000000,
            scriptPubKey: '21034b2edef6108e596efb2955f796aa807451546025025833e555b6f9b433a4a146ac'
        })
    }

    const tempTX = new bsv$1.Transaction().from([getDummyUTXO()]).change("19dCWu1pvak7cgw5b1nFQn9LapFSQLqahC");
    tempTX.addOutput(new bsv$1.Transaction.Output({script, satoshis }));
    return Math.ceil(tempTX._estimateSize() * feeb);
}


async function fireForUTXO(privateKey, utxo, changeAddress, satoshis, hash, target) {
    if (!privateKey) { throw new Error(`shooter requires a privateKey`) }
    if (!utxo) { throw new Error(`shooter requires a utxo`) }
    if (!hash) { throw new Error(`shooter requires a hash`) }
    if (!target) { throw new Error(`shooter requires a target`) }
    if (!changeAddress) { throw new Error(`shooter requires a change address`) }
    if (!Number.isInteger(satoshis)) { throw new Error(`shooter requires an amount`) }

    const script = bsv$1.Script.fromASM(`${hash} ${target} OP_SIZE OP_4 OP_PICK OP_SHA256 OP_SWAP OP_SPLIT OP_DROP OP_EQUALVERIFY OP_DROP OP_CHECKSIG`);

    const fee = estimateFeeForScript(script);

    const tx = bsv$1.Transaction()
        .from([utxo])
        .change(changeAddress)
        .addOutput(bsv$1.Transaction.Output({
            script: script.toHex(),
            satoshis: (satoshis - fee),
        }));

    tx.sign(privateKey);

    if (tx.verify() !== true) {
        console.log("error while verifying tx for utxo", utxo);
        throw new Error(`error while verifying tx`);
    }

    const txhash = tx.uncheckedSerialize();

    const txid = await sendtx(txhash);

    if (!txid) {
        console.log("error while sending tx for utxo", utxo);
        throw new Error(`error while sending tx ${txhash}`);
    }

    return txid;
}

async function fire(wif, num, satoshis, hash, target) {
    console.log("starting transaction shooter");
    if (!wif) { throw new Error(`shooter requires a wif`) }
    if (!hash) { throw new Error(`shooter requires a hash`) }
    if (!target) { throw new Error(`shooter requires a target`) }
    if (!Number.isInteger(num)) { throw new Error(`shooter requires a num`) }
    if (!Number.isInteger(satoshis)) { throw new Error(`shooter requires an amount`) }

    const privateKey = bsv$1.PrivateKey(wif);
    const address = bsv$1.Address.fromPrivateKey(privateKey).toString();
    console.log(`loading private key that owns address ${address}`);

    const utxos$1 = await utxos(address);
    if (utxos$1.length < num) { throw new Error(`don't have enough utxos, need to split them`) }

    const sats = utxos$1.map(utxo => { return utxo.satoshis }).reduce((a, b) => a + b, 0);
    console.log(`found ${utxos$1.length} utxos worth ${sats} satoshis`);

    const expectedSpend = (num * satoshis);
    if (expectedSpend > sats) { throw new Error(`don't have enough money to send ${expectedSpend} satoshis to ${target}`) }

    let curr = 0;
    console.log("aim");
    for (const utxo of utxos$1) {
        const txid = await fireForUTXO(privateKey, utxo, address, satoshis, hash, target);
        if (!txid) { throw new Error(`error firing tx to target`) }

        curr += 1;
        console.log(`💥 FIRE ${txid}`);

        if (curr >= num) {
            console.log(`FIRED ${curr}/${num} targets`);
            break;
        }
    }
}

Object.fromEntries = arr => Object.assign({}, ...Array.from(arr, ([k, v]) => ({[k]: v}) ));

const log$2 = require("debug")("powpow:bit");

// fetch and generate new .bit files
async function generate(file=".bit") {

    const filepath = path.join(process.cwd(), file);
    if (fs.existsSync(filepath)) {
        throw new Error(`existing ${file} file found, please move it before writing a new one`);
    }

    const privateKey = bsv$1.PrivateKey.fromRandom();

    const PRIVATE = privateKey.toString();
    const ADDRESS = bsv$1.Address.fromPrivateKey(privateKey).toString();
    const PUBLIC = bsv$1.PublicKey.fromPrivateKey(privateKey).toString();

    const bundle = { PRIVATE, ADDRESS, PUBLIC };

    write(bundle);

    const written = await fetch(file);
    if (!written || written.ADDRESS !== ADDRESS) {
        throw new Error("error while writing new address, didn't match the one generated");
    }

    return bundle;
}

async function read(file=".bit") {
    const filepath = path.join(process.cwd(), file);
    if (fs.existsSync(filepath)) {
        const contents = fs.readFileSync(filepath, "utf8");
        return contents;
    } else {
        return null;
    }
}

async function write(bundle, file=".bit") {
    const filepath = path.join(process.cwd(), file);
    if (fs.existsSync(filepath)) {
        throw new Error(`existing .bit file found, please move it before writing a new one`);
    }

    const content = Object.entries(bundle).map(([key, value]) => {
        return `${key.toUpperCase()}=${value}`;
    }).join("\n");

    log$2(`writing ${content.length} bytes to ${file}`);

    fs.writeFileSync(filepath, content, "utf8");
    return true;
}


function parse(bit) {
    const lines = Object.fromEntries(bit.split("\n").filter(line => !!line).map(line => {
        return line.split("=");
    }));
    //log(`parsing ${JSON.stringify(lines, null, 4)}`);
    return lines;
}

async function fetch(file=".bit") {
    const contents = await read(file);
    if (contents) {
        const bundle = parse(contents);

        // VERIFY
        const address = bsv$1.Address.fromPrivateKey(bsv$1.PrivateKey(bundle.PRIVATE)).toString();
        if (address !== bundle.ADDRESS) {
            throw new Error(`error while validating the bundle, the private key doesn't match the address`);
        }

        log$2(`loaded .bit with address ${bundle.ADDRESS}`);
        return bundle;
    }
}

/*
import fs from "fs"
import ReadLastLines from "read-last-lines"

export function get(file) {
    return new Promise((resolve, reject) => {
        ReadLastLines.read(file, 10).then(str => {
            const lines = str.split("\n").filter(line => !!line);
            const last = lines.pop();
            const line = last.split(" ");
            if (line.length !== 5) { throw new Error("expected tape to have 4 elements") }
            if (line[0] === "BLOCK") {
                const height = Number(line[1]);
                resolve(height);
            } else {
                resolve(null);
            }
        }).catch(e => {
            resolve(null);
        });
    });
}

export function write(line, file) {
    return new Promise((resolve, reject) => {
        try {
            fs.appendFileSync(file, `${line}\n`);
            resolve(true);
        } catch (e) {
            reject(e);
        }
    });
}
*/

const bsv = require("bsv");
const bitindex$2 = require('bitindex-sdk').instance();

async function splitUTXO(privateKey, utxo, changeAddress, num, satoshis) {
    if (!privateKey) { throw new Error(`shooter requires a privateKey`) }
    if (!utxo) { throw new Error(`shooter requires a utxo`) }
    if (!changeAddress) { throw new Error(`shooter requires a change address`) }
    if (!Number.isInteger(num)) { throw new Error(`shooter requires number of txs to split`) }
    if (!Number.isInteger(satoshis)) { throw new Error(`shooter requires an amount`) }

    if (utxo.satoshis <= satoshis) {
        //console.log(`skipping utxo ${utxo.txid}:${utxo.vout}, already split`);
        return 0;
    }

    if ((satoshis * 2.5) > utxo.satoshis) {
        //console.log(`skipping utxo ${utxo.txid}:${utxo.vout}, because it's small`);
        return 0;
    }

    //console.log(`SPLITING ${JSON.stringify(utxo, null, 4)}`);

    const tx = bsv.Transaction().from([utxo]).change(changeAddress);
    let totalsatoshis = 0;
    let numsplit;
    let hasaddress = false;
    for (numsplit = 0; numsplit < num; numsplit++) {
        totalsatoshis += satoshis;
        if (totalsatoshis > utxo.satoshis) {
            break;
        }

        tx.to(changeAddress, satoshis);
        hasaddress = true;
    }

    if (!hasaddress) {
        console.log(`unable to split ${utxo.txid}:${utxo.vout}`);
        return 0;
    }

    tx.sign(privateKey);

    const txhash = tx.serialize();

    const txid = await sendtx(txhash);

    if (!txid) {
        console.log("error while sending tx for utxo", utxo);
        throw new Error(`error while sending tx ${txid}`);
    }

    console.log("SPLIT", `${utxo.txid}:${utxo.vout} into`, numsplit, "utxos in", txid);
    return txid;
}


async function split(wif, num, satoshis) {
    console.log("preparing transaction shooter by splitting utxos");

    if (!wif) { throw new Error(`shooter requires a wif`) }
    if (!Number.isInteger(num)) { throw new Error(`shooter requires a num`) }
    if (!Number.isInteger(satoshis)) { throw new Error(`shooter requires an amount`) }

    const privateKey = bsv.PrivateKey(wif);
    const address = bsv.Address.fromPrivateKey(privateKey).toString();
    console.log(`loading private key ${wif} that owns address ${address}`);

    const utxos = await bitindex$2.address.getUtxosWithOptions({
        addrs: [address],
        limit: 10000
    });

    console.log(`${utxos.length} utxos`);

    let split = 0;
    for (const utxo of utxos) {
        const numsplit = await splitUTXO(privateKey, utxo, address, num, satoshis);
        if (numsplit > 0) {
            console.log(`SPLIT ${numsplit} utxos from ${utxo.txid}:${utxo.vout} into ${satoshis} each`);
        }
        split += numsplit;
        if (split >= num) {
            console.log("SUCCESS splitting utxo");
            break;
        }
    }
}

const log$3 = require("debug")("powpow");

const readline = require("readline");

program.on('--help', function(){
  console.log('');
  console.log('Usage:');
  console.log('  $ powpow generate');
  console.log('  $ powpow address');
  console.log('  $ powpow split');
  console.log('  $ powpow fire 21e80096c21e2de52d741ac27607e251770c0b9f7e644f684cf37173e871820e 21e8');
  console.log('');
});

async function balance() {
    let bundle = await fetch();
    if (!bundle) {
        log$3(`error finding address information, please inspect you .bit file`);
        return;
    }

    utxos(bundle.ADDRESS).then(results => {
        let balance = 0;
        for (const utxo of results) {
            balance += utxo.satoshis;
        }
        console.log(`\nBALANCE ${balance}`);
    }).catch(e => {
        console.log(`ERROR while fetching utxos ${e.message}`);
    });
}

async function showutxos() {
    let bundle = await fetch();
    if (!bundle) {
        log$3(`error finding address information, please inspect you .bit file`);
        return;
    }

    utxos(bundle.ADDRESS).then(results => {
        let balance = 0;
        for (const utxo of results) {
            console.log(`${utxo.satoshis} ${utxo.txid}:${utxo.vout}`);
            balance += utxo.satoshis;
        }
        console.log(`UTXOS ${results.length}`);
        console.log(`\nBALANCE ${balance}`);
    }).catch(e => {
        console.log(`ERROR while fetching utxos ${e.message}`);
    });
}


async function address() {
    let bundle = await fetch();
    if (!bundle) {
        log$3(`error finding address information, please inspect you .bit file`);
        return;
    }

    qrcode.generate(`bitcoin:${bundle.ADDRESS}`, function(message) {
        console.log("\n");
        console.log("💥 Pow Pow Transaction Shooter Address");
        console.log("\n");
        console.log(message);
        console.log("\nADDRESS", bundle.ADDRESS);
        balance();
    });
}

program.version("0.0.1");

program
    .command("generate")
    .description("Generate address")
    .action(async function() {
        let bundle = await fetch();
        if (bundle) {
            log$3(`already generated address`);
        } else {
            log$3(`generating address`);
            bundle = await generate();
            log$3(`generated address ${bundle.ADDRESS}`);
            address();
        }
    });

program
    .command("address")
    .description("Display address")
    .action(async function() {
        address();
    });

program
    .command("balance")
    .description("Display balance for address")
    .action(async function() {
        balance();
    });

program
    .command("utxos")
    .description("Display utxos for address")
    .action(async function() {
        showutxos();
    });

program
    .command("split")
    .description("Split utxos in preparation for firing")
    .option("-s, --satoshis <satoshis>", "Change the number of satoshis to send, by default 1000")
    .option("-l, --limit <limit>", "Maximum number of utxos, by default 25")
    .action(async function(args) {
        let bundle = await fetch();
        if (!bundle) {
            log$3(`error finding address information, please inspect you .bit file`);
            return;
        }

        const satoshis = (args.satoshis ? Number(args.satoshis) : 1000);
        const limit = (args.limit ? Number(args.limit) : 25);

        split(bundle.PRIVATE, limit, satoshis).then(function() {
            console.log("FINISHED splitting utxos");
        }).catch(e => {
            console.log(e);
            console.log(`ERROR while splitting utxos`);
        });
    });

program
    .command("fire <sha256 hash> <target> [number]")
    .option("-s, --satoshis <satoshis>", "Change the number of satoshis to send, by default 1000")
    .description("Fire Pow Pow, sending num Bitcoin transactions to an address")
    .action(async function(hash, target, number, args) {
        let bundle = await fetch();
        if (!bundle) {
            log$3(`error finding address information, please inspect you .bit file`);
            return;
        }

        const satoshis = (args.satoshis ? Number(args.satoshis) : 1000);
        console.log("HASH", hash, hash.length);
        if (!hash || hash.length !== 64) {
            console.log(`ERROR invalid hash ${hash}`);
            process.exit();
        }

        if (!target) {
            console.log(`ERROR invalid target`);
            process.exit();
        }

        const num = (number ? Number(number) : 10);

        const prompt  = readline.createInterface(process.stdin, process.stdout);
        console.log("===================================================");
        console.log("⚠️  WARNING ⚠️");
        console.log(`\nAre you sure you want to FIRE at`);
        console.log(`HASH: ${hash}`);
        console.log(`TARGET: ${target}`);
        console.log(`NUMBER: ${num}`);
        console.log(`SATOSHIS: ${satoshis}`);
        console.log(`TOTAL SATOSHIS: ${num * satoshis}`);
        console.log("\n⚠️  WARNING ⚠️");
        console.log("===================================================");
        prompt.setPrompt("Are you sure you want to proceed? [y/N]> ");
        prompt.prompt();
        prompt.on("line", async function(line) {
            if (line == "y") {
                console.log("💥 FIRING PoW");
                fire(bundle.PRIVATE, num, satoshis, hash, target).catch(e => {
                    console.log(`ERROR while firing transactions`);
                    console.log(e);
                });
            } else {
                console.log("\nSkipping... CEASE FIRE\n");
            }
            prompt.close();
        });
    });

program.on('command:*', function () {
  console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
  process.exit(1);
});

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

program.parse(process.argv);
