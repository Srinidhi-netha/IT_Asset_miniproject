sap.ui.define([], function () {
    "use strict";

    // Minimal text-only PDF writer (A4, Helvetica). No external libraries, so it works
    // inside the BTP CSP. Non-ASCII Latin-1 characters (ä, ö, ü, ß, ...) are written as
    // octal escapes and render correctly through WinAnsiEncoding.
    var PAGE_W = 595, PAGE_H = 842, MARGIN = 40;

    function esc(s) {
        var out = "";
        String(s === undefined || s === null ? "" : s).split("").forEach(function (ch) {
            var c = ch.charCodeAt(0);
            if (ch === "\\" || ch === "(" || ch === ")") { out += "\\" + ch; }
            else if (c >= 32 && c < 127) { out += ch; }
            else if (c >= 160 && c < 256) { out += "\\" + c.toString(8); }
            else if (c === 8364) { out += "\\200"; }                    // €
            else if (c === 8211 || c === 8212) { out += "-"; }         // dashes
            else if (c === 8239 || c === 8201 || c === 8202) { out += " "; } // narrow/thin spaces in formatted times
            else { out += "?"; }
        });
        return out;
    }

    // Rough Helvetica width estimate, good enough to truncate table cells.
    function fit(text, maxWidth, size) {
        var s = String(text === undefined || text === null ? "" : text);
        var maxChars = Math.floor(maxWidth / (size * 0.52));
        return s.length > maxChars ? s.slice(0, Math.max(maxChars - 1, 1)) + "..." : s;
    }

    function PdfReport() {
        this._pages = [];
        this._newPage();
    }

    PdfReport.prototype._newPage = function () {
        this._ops = [];
        this._pages.push(this._ops);
        this._y = PAGE_H - MARGIN;
    };

    PdfReport.prototype._ensure = function (h) {
        if (this._y - h < MARGIN) { this._newPage(); }
    };

    PdfReport.prototype._text = function (x, y, str, size, bold) {
        this._ops.push("BT /" + (bold ? "F2" : "F1") + " " + size + " Tf " + x + " " + y + " Td (" + esc(str) + ") Tj ET");
    };

    PdfReport.prototype.text = function (str, opts) {
        opts = opts || {};
        var size = opts.size || 10;
        this._ensure(size + 6);
        this._y -= size + 4;
        this._text(MARGIN, this._y, fit(str, PAGE_W - 2 * MARGIN, size), size, opts.bold);
        return this;
    };

    PdfReport.prototype.space = function (h) {
        this._y -= h || 8;
        return this;
    };

    PdfReport.prototype.line = function () {
        this._ensure(6);
        this._y -= 4;
        this._ops.push("0.6 G " + MARGIN + " " + this._y + " m " + (PAGE_W - MARGIN) + " " + this._y + " l S 0 G");
        return this;
    };

    // columns: [{ header, width (fraction of usable width) }], rows: [[cell, ...], ...]
    PdfReport.prototype.table = function (columns, rows) {
        var that = this, size = 9, rowH = 14, usable = PAGE_W - 2 * MARGIN;
        var xs = [], x = MARGIN;
        columns.forEach(function (c) { xs.push(x); x += c.width * usable; });

        var header = function () {
            that._ensure(rowH * 2);
            that._y -= rowH;
            that._ops.push("0.93 g " + MARGIN + " " + (that._y - 4) + " " + usable + " " + rowH + " re f 0 g");
            columns.forEach(function (c, i) {
                that._text(xs[i] + 3, that._y, fit(c.header, c.width * usable - 6, size), size, true);
            });
        };

        header();
        rows.forEach(function (r) {
            if (that._y - rowH < MARGIN) { that._newPage(); header(); }
            that._y -= rowH;
            r.forEach(function (cell, i) {
                that._text(xs[i] + 3, that._y, fit(cell, columns[i].width * usable - 6, size), size, false);
            });
        });
        return this;
    };

    PdfReport.prototype.toBlob = function (footer) {
        var objs = [], pageIds = [];
        var add = function (body) { objs.push(body); return objs.length; };

        add("<< /Type /Catalog /Pages 2 0 R >>");
        add(null); // pages tree, filled in below
        var f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
        var f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

        var total = this._pages.length;
        this._pages.forEach(function (ops, i) {
            var foot = "BT /F1 8 Tf " + MARGIN + " 22 Td (" + esc((footer || "") + "  -  " + (i + 1) + " / " + total) + ") Tj ET";
            var stream = ops.concat(foot).join("\n");
            var content = add("<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream");
            pageIds.push(add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PAGE_W + " " + PAGE_H + "] " +
                "/Resources << /Font << /F1 " + f1 + " 0 R /F2 " + f2 + " 0 R >> >> /Contents " + content + " 0 R >>"));
        });
        objs[1] = "<< /Type /Pages /Kids [" + pageIds.map(function (id) { return id + " 0 R"; }).join(" ") +
            "] /Count " + pageIds.length + " >>";

        // Everything above is plain ASCII, so string length equals byte offset.
        var pdf = "%PDF-1.4\n", offsets = [];
        objs.forEach(function (body, i) {
            offsets.push(pdf.length);
            pdf += (i + 1) + " 0 obj\n" + body + "\nendobj\n";
        });
        var xref = pdf.length;
        pdf += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n";
        offsets.forEach(function (o) { pdf += ("0000000000" + o).slice(-10) + " 00000 n \n"; });
        pdf += "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
        return new Blob([pdf], { type: "application/pdf" });
    };

    PdfReport.prototype.download = function (fileName, footer) {
        var url = URL.createObjectURL(this.toBlob(footer));
        var a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    };

    return PdfReport;
});
