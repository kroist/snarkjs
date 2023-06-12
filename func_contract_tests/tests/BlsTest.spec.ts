import { Blockchain, SandboxContract } from '@ton-community/sandbox';
import { Cell, toNano } from 'ton-core';
import { BlsTest, compileAndDeploy } from '../wrappers/BlsTest';
import '@ton-community/test-utils';
import * as snarkjs from "snarkjs";
import path from "path";
import fs from "fs";
import { buildBls12381, utils }   from "ffjavascript";
const {unstringifyBigInts} = utils;


describe('BlsTest', () => {

    const ptauFilename = path.join("./tests", "pot14_final.ptau");

    const templates = {};
    (templates as any).groth16 = fs.readFileSync(path.join("../templates", "verifier_groth16.func.ejs"), "utf8");
    

    it('should deploy', async () => {
        await compileAndDeploy();
        // the check is done inside beforeEach
        // blockchain and blsTest are ready to use
        return;
    });


    it ('Groth16 smart contract 3 inputs', async () =>
        await groth16Verify(
            path.join("./tests", "circuit2", "circuit.r1cs"),
            path.join("./tests", "circuit2", "witness.wtns")
        )
    );


    
    async function groth16Verify(r1csFilename, wtnsFilename) {
        const funcVerifierFilename = path.join("contracts", "verifier.fc");

        const zkeyFilename = { type: "mem" };

        await snarkjs.zKey.newZKey(r1csFilename, ptauFilename, zkeyFilename);
        const { proof: proof, publicSignals: pubInputs } = await snarkjs.groth16.prove(zkeyFilename, wtnsFilename);

        // Generate groth16 verifier solidity file from groth16 template + zkey
        const verifierCode = await snarkjs.zKey.exportFuncVerifier(zkeyFilename, templates);
        fs.writeFileSync(funcVerifierFilename, verifierCode, "utf-8");


        let blockchain: Blockchain;
        let blsTest: SandboxContract<BlsTest>;
        [blockchain, blsTest] = await compileAndDeploy();
        
        let curve = await buildBls12381();
        let proofProc = unstringifyBigInts(proof);

        var pi_aS = g1Compressed(curve, proofProc.pi_a);
        var pi_bS = g2Compressed(curve, proofProc.pi_b);
        var pi_cS = g1Compressed(curve, proofProc.pi_c);

        const verifier = await blockchain.treasury('verifier' + 1);

        var pi_a = Buffer.from(pi_aS, "hex");
        var pi_b = Buffer.from(pi_bS, "hex");
        var pi_c = Buffer.from(pi_cS, "hex");
        const verifyResult = await blsTest.sendVerify(verifier.getSender(), {
            pi_a: pi_a,
            pi_b: pi_b,
            pi_c: pi_c,
            pubInputs: pubInputs,
            value: toNano('10'),
        });

        expect(verifyResult.transactions).toHaveTransaction({
            from: verifier.address,
            to: blsTest.address,
            success: true,
        });

        const res = await blsTest.getRes();

        expect(res).not.toEqual(0);

        return;
        

    }

    function g1Compressed(curve, p1Raw) {
        let p1 = curve.G1.fromObject(p1Raw);

        let buff = new Uint8Array(48);
        curve.G1.toRprCompressed(buff, 0, p1);
        // convert from ffjavascript to blst format
        if (buff[0] & 0x80) {
            buff[0] |= 32;
        }
        buff[0] |= 0x80;
        return toHexString(buff);
    }

    function g2Compressed(curve, p2Raw) {
        let p2 = curve.G2.fromObject(p2Raw);

        let buff = new Uint8Array(96);
        curve.G2.toRprCompressed(buff, 0, p2);
        // convert from ffjavascript to blst format
        if (buff[0] & 0x80) {
            buff[0] |= 32;
        }
        buff[0] |= 0x80;
        return toHexString(buff);
    }

    function toHexString(byteArray) {
        return Array.from(byteArray, function(byte: any) {
            return ('0' + (byte & 0xFF).toString(16)).slice(-2);
        }).join("");
    }

});
