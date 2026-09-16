// A minimal ustar/GNU-tar reader, just enough to unpack
// swift-sysroot-core.tar into an in-memory Directory tree for the WASI shim:
// regular files ('0'/'\0'), directories ('5'), and GNU long-name entries
// ('L') for paths over the 100-byte ustar field. PAX extended headers
// ('x'/'g') are skipped rather than parsed — the sysroot tarball is built by
// GNU tar, which uses 'L' for long names, not PAX.

import { Directory, File } from "https://esm.sh/@bjorn3/browser_wasi_shim@0.4.2";

function readCString(view, offset, length) {
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, length);
  const nul = bytes.indexOf(0);
  return new TextDecoder().decode(nul === -1 ? bytes : bytes.subarray(0, nul));
}

function readOctal(view, offset, length) {
  const str = readCString(view, offset, length).trim();
  return str.length ? parseInt(str, 8) : 0;
}

function mkdirp(root, parts) {
  let dir = root;
  for (const part of parts) {
    if (part === "") continue;
    let next = dir.contents.get(part);
    if (next === undefined) {
      next = new Directory(new Map());
      next.parent = dir;
      dir.contents.set(part, next);
    } else if (!(next instanceof Directory)) {
      throw new Error(`tar: '${part}' is both a file and a directory`);
    }
    dir = next;
  }
  return dir;
}

// GNU tar entries in the sysroot archive are written as "./a/b/c" — drop the
// leading "." component along with empty ones, or every path ends up nested
// under a spurious "." directory.
function pathParts(path) {
  return path.split("/").filter((p) => p !== "" && p !== ".");
}

function putFile(root, path, data) {
  const parts = pathParts(path);
  const name = parts.pop();
  const dir = mkdirp(root, parts);
  dir.contents.set(name, new File(data));
}

/** Parses a tar ArrayBuffer into a Directory tree rooted at "/". */
export function untar(buffer) {
  const root = new Directory(new Map());
  let offset = 0;
  let pendingLongName = null;

  while (offset + 512 <= buffer.byteLength) {
    const header = new DataView(buffer, offset, 512);
    // A block of all zero bytes marks the end of the archive.
    if (new Uint8Array(buffer, offset, 512).every((b) => b === 0)) break;

    let name = readCString(header, 0, 100);
    const size = readOctal(header, 124, 12);
    const typeflag = String.fromCharCode(header.getUint8(156)) || "0";
    const prefix = readCString(header, 345, 155);
    if (prefix) name = `${prefix}/${name}`;

    const dataStart = offset + 512;
    const dataLen = size;
    offset = dataStart + Math.ceil(dataLen / 512) * 512;

    if (typeflag === "L") {
      // GNU long name: payload is the real name of the *next* entry.
      pendingLongName = new TextDecoder()
        .decode(new Uint8Array(buffer, dataStart, dataLen))
        .replace(/\0+$/, "");
      continue;
    }
    if (pendingLongName) {
      name = pendingLongName;
      pendingLongName = null;
    }
    if (!name) continue;

    if (typeflag === "5") {
      mkdirp(root, pathParts(name));
    } else if (typeflag === "0" || typeflag === "\0" || typeflag === "") {
      const data = buffer.slice(dataStart, dataStart + dataLen);
      putFile(root, name.replace(/\/+$/, ""), data);
    }
    // Symlinks ('2'), PAX headers ('x'/'g') and other exotic types aren't
    // needed by this sysroot and are skipped.
  }

  return root;
}
