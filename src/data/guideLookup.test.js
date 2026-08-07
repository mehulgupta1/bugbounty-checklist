import assert from "node:assert";
import { buildGuideById } from "./guideLookup.js";

// The whole point: guide survives a rename because it's keyed by id, not text.
const cats = [{ sections: [{ checks: [{ id: "a1", text: "Test XSS" }] }] }];
const guides = { "Test XSS": "Run: xss payload" };
const byId = buildGuideById(cats, guides);

assert.equal(byId["a1"], "Run: xss payload");        // joined by id at build time

const renamed = { id: "a1", text: "Test XSS (reflected)" };  // user edited the text
assert.equal(byId[renamed.id], "Run: xss payload");  // guide still found → fix works

console.log("ok");
