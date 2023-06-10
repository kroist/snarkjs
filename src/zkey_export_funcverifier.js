import ejs from "ejs";

import exportVerificationKey from "./zkey_export_verificationkey.js";
import * as curves from "./curves.js";
import {  utils }   from "ffjavascript";
const {unstringifyBigInts} = utils;

export default async function exportFuncVerifier(zKeyName, templates, logger) {

    const verificationKey = await exportVerificationKey(zKeyName, logger);

    if ("fflonk" === verificationKey.protocol || "plonk" === verificationKey.protocol) {
        throw new Error("Not Supported Yet!");
    }

    let template = templates[verificationKey.protocol];
    let reformatedVk = await reformatVerificationKeyGroth16(verificationKey);
    console.log(reformatedVk);

    return ejs.render(template, reformatedVk);
}


async function reformatVerificationKeyGroth16(verificationKey) {


    const curve = await curves.getCurveFromName(verificationKey.curve);
    const vk_verifier = unstringifyBigInts(verificationKey);

    verificationKey.vk_alpha_1 = g1Compressed(curve, vk_verifier.vk_alpha_1);
    verificationKey.vk_beta_2 = g2Compressed(curve, vk_verifier.vk_beta_2);
    verificationKey.vk_gamma_2 = g2Compressed(curve, vk_verifier.vk_gamma_2);
    verificationKey.vk_delta_2 = g2Compressed(curve, vk_verifier.vk_delta_2);
    let arr = vk_verifier.IC.map(x => g1Compressed(curve, x));
    verificationKey.IC = arr;
    return verificationKey;

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
    return Array.from(byteArray, function(byte) {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join("");
}
