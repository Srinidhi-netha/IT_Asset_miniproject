sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/ui/core/format/DateFormat",
    "sap/base/i18n/Localization",
    "sap/m/MessageToast",
    "sap/m/library",
    "managerdashboard/util/PdfReport"
], function (Controller, JSONModel, Fragment, DateFormat, Localization, MessageToast, mobileLibrary, PdfReport) {
    "use strict";

    var DAY = 24 * 60 * 60 * 1000;
    var STATUSES = ["In Stock", "Assigned", "Maintenance", "Retired", "Archived"];

    // Managers only open the apps they may see; same intents as the launchpad tiles (<SemanticObject>-manage).
    // Outside a launchpad the app is opened directly.
    var APP_URLS = {
        Assets: "../assets/index.html",
        Maintenance: "../maintenance/index.html"
    };

    function iso(d) {
        if (!d) { return ""; }
        var m = d.getMonth() + 1, day = d.getDate();
        return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (day < 10 ? "0" + day : day);
    }

    function isOpen(r) {
        return r.status === "Open" || r.status === "In Progress";
    }

    return Controller.extend("managerdashboard.controller.ManagerDashboard", {

        onInit: function () {
            var that = this;
            this._assets = [];
            this._ledger = [];
            this._maintenance = [];
            this._posted = [];
            this._rows = [];
            this._dateFmt = DateFormat.getDateInstance({ style: "medium" });
            this._dateTimeFmt = DateFormat.getDateTimeInstance({ style: "medium" });

            this.getView().setModel(new JSONModel({
                busy: false, error: "", updated: "",
                language: Localization.getLanguage().slice(0, 2).toLowerCase() === "de" ? "de" : "en",
                filters: { status: "", category: "", location: "", department: "", from: null, to: null },
                options: { statuses: [], categories: [], locations: [], departments: [] },
                kpi: {}, kpiText: {},
                statusSegments: [], segmentCount: 1,
                departmentBars: [], deptBarCount: 1,
                maintTypeBars: [], maintBarCount: 1,
                assignments: [], history: [], maintenance: [], summary: [],
                notifications: [], notifCount: "0"
            }), "dash");

            // getResourceBundle() returns a Promise when the i18n model is loaded async
            Promise.resolve(this.getOwnerComponent().getModel("i18n").getResourceBundle()).then(function (bundle) {
                that._bundle = bundle;
                that._load();
            });
        },

        _t: function (key, args) {
            return this._bundle.getText(key, args);
        },

        // Translate a backend code value (status, action, type, ...) when a text exists, else show it as is.
        _tr: function (prefix, value) {
            var key = prefix + "_" + String(value || "").replace(/\s/g, "");
            return value && this._bundle.hasText(key) ? this._t(key) : (value || "");
        },

        _date: function (s) {
            return s ? this._dateFmt.format(new Date(s + (s.length === 10 ? "T00:00:00" : ""))) : "";
        },

        _serviceUrl: function () {
            var uri = this.getOwnerComponent().getManifestEntry("/sap.app/dataSources/mainService/uri") || "/odata/v4/catalog/";
            return uri.slice(-1) === "/" ? uri : uri + "/";
        },

        _get: function (path) {
            return fetch(this._serviceUrl() + path, {
                headers: { Accept: "application/json", "Accept-Language": Localization.getLanguage() },
                credentials: "same-origin"
            }).then(function (r) {
                if (!r.ok) {
                    return r.text().then(function (t) {
                        var msg = t;
                        try { msg = JSON.parse(t).error.message; } catch (e) { /* keep raw text */ }
                        throw new Error(r.status + " on " + path.split("?")[0] + ": " + msg);
                    });
                }
                return r.json();
            }).then(function (j) { return j.value || []; });
        },

        _load: function () {
            var that = this, model = this.getView().getModel("dash");
            model.setProperty("/busy", true);
            model.setProperty("/error", "");

            var soft = function (p) { return p.catch(function () { return []; }); };

            // Read-only dashboard views: managers have no access to the master data entities.
            Promise.all([
                this._get("AssetOverviewSrv?$select=asset_ID,assetTag,model,serialNumber,status,purchaseDate,warrantyExpiry,firstDistributionDate," +
                    "categoryName,holderId,holderName,holderLocation,holderDepartment&$top=5000"),
                soft(this._get("AssetHistorySrv?$select=ledger_ID,assetId,action,transitionDate,fromName,toId,toName,notes,createdAt" +
                    "&$orderby=transitionDate desc,createdAt desc&$top=5000")),
                soft(this._get("MaintenanceOverviewSrv?$select=maintenance_ID,assetId,type,vendorName,reportedDate,completedDate,status&$orderby=reportedDate desc&$top=5000"))
            ]).then(function (res) {
                var none = that._t("unassigned");
                that._assets = res[0].map(function (a) {
                    a._category   = a.categoryName || that._t("noCategory");
                    a._holder     = a.holderName || none;
                    a._location   = (a.holderId && a.holderLocation) || none;
                    a._department = (a.holderId && a.holderDepartment) || none;
                    return a;
                });
                that._ledger = res[1];
                that._maintenance = res[2];

                that._buildOptions();
                that._refresh();
                model.setProperty("/updated", new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
            }).catch(function (e) {
                model.setProperty("/error", that._t("loadError", [e.message]));
            }).finally(function () {
                model.setProperty("/busy", false);
            });
        },

        _distinct: function (key, allText) {
            var seen = {}, list = [];
            this._assets.forEach(function (a) {
                var v = a[key];
                if (v && !seen[v]) { seen[v] = true; list.push({ key: v, text: v }); }
            });
            list.sort(function (x, y) { return x.text.localeCompare(y.text); });
            list.unshift({ key: "", text: allText });
            return list;
        },

        _buildOptions: function () {
            var that = this, m = this.getView().getModel("dash");
            var statuses = STATUSES.map(function (s) { return { key: s, text: that._tr("status", s) }; });
            statuses.unshift({ key: "", text: this._t("allStatuses") });
            m.setProperty("/options/statuses",    statuses);
            m.setProperty("/options/categories",  this._distinct("_category",   this._t("allCategories")));
            m.setProperty("/options/locations",   this._distinct("_location",   this._t("allLocations")));
            m.setProperty("/options/departments", this._distinct("_department", this._t("allDepartments")));
        },

        _filteredRows: function () {
            var f = this.getView().getModel("dash").getProperty("/filters");
            var from = iso(f.from), to = iso(f.to);
            return this._assets.filter(function (a) {
                if (f.status     && a.status !== f.status)          { return false; }
                if (f.category   && a._category !== f.category)     { return false; }
                if (f.location   && a._location !== f.location)     { return false; }
                if (f.department && a._department !== f.department) { return false; }
                if (from && (!a.purchaseDate || a.purchaseDate < from)) { return false; }
                if (to   && (!a.purchaseDate || a.purchaseDate > to))   { return false; }
                return true;
            });
        },

        _bars: function (items, keyFn) {
            var by = {};
            items.forEach(function (x) { var k = keyFn(x); by[k] = (by[k] || 0) + 1; });
            return Object.keys(by).map(function (k) {
                return { label: k, value: by[k], display: String(by[k]) };
            }).sort(function (x, y) { return y.value - x.value; }).slice(0, 6);
        },

        _refresh: function () {
            var that = this, m = this.getView().getModel("dash");
            var rows = this._rows = this._filteredRows();
            var none = this._t("unassigned");

            var count = function (s) { return rows.filter(function (a) { return a.status === s; }).length; };
            var total = rows.length, available = count("In Stock"), assigned = count("Assigned"),
                maint = count("Maintenance"), retired = count("Retired"), archived = count("Archived");
            var pct = function (n) { return total ? Math.round(n * 100 / total) : 0; };

            var locs = {};
            rows.forEach(function (a) { if (a._location !== none) { locs[a._location] = true; } });
            var locCount = Object.keys(locs).length;

            var byId = {};
            rows.forEach(function (a) { byId[a.asset_ID] = a; });

            // Maintenance of the filtered assets: open records first, then the most recent
            var now = Date.now(), cutoff = now - 7 * DAY;
            var maintRows = this._maintenance.filter(function (r) { return byId[r.assetId]; });
            var open = maintRows.filter(isOpen);
            var overdue = open.filter(function (r) {
                return r.reportedDate && new Date(r.reportedDate).getTime() < cutoff;
            }).length;

            // Ownership ledger of the filtered assets (already sorted newest first)
            var ledger = this._ledger.filter(function (l) { return byId[l.assetId]; });
            var since30 = iso(new Date(now - 30 * DAY));
            var recent = ledger.filter(function (l) { return l.transitionDate && l.transitionDate >= since30; });
            var assignments30 = recent.filter(function (l) { return l.action === "Assign" || l.action === "Reassign"; }).length;
            var returns30 = recent.filter(function (l) { return l.action === "Return"; }).length;

            var kpi = { total: total, assigned: assigned, available: available, maintenance: maint,
                        openMaint: open.length, assignments30: assignments30 };
            var kpiText = {
                total:         this._t("ctxLocations",   [locCount]),
                assigned:      this._t("ctxUtilization", [pct(assigned)]),
                available:     this._t("ctxInventory",   [pct(available)]),
                maintenance:   this._t("ctxAttention",   [overdue]),
                openMaint:     this._t("ctxOverdue",     [overdue]),
                assignments30: this._t("ctxReturns",     [returns30])
            };
            m.setProperty("/kpi", kpi);
            m.setProperty("/kpiText", kpiText);

            var segs = [
                { s: "Assigned",    value: assigned,  color: "Neutral" },
                { s: "In Stock",    value: available, color: "Good" },
                { s: "Maintenance", value: maint,     color: "Critical" },
                { s: "Retired",     value: retired,   color: "Error" },
                { s: "Archived",    value: archived,  color: "Neutral" }
            ].filter(function (s) { return s.value > 0; }).map(function (s) {
                return { label: that._tr("status", s.s) + " (" + pct(s.value) + "%)", value: s.value, display: String(s.value), color: s.color };
            });
            m.setProperty("/statusSegments", segs);
            m.setProperty("/segmentCount", Math.max(segs.length, 1));

            var deptBars = this._bars(rows.filter(function (a) { return a.status === "Assigned" && a._department !== none; }),
                function (a) { return a._department; });
            m.setProperty("/departmentBars", deptBars);
            m.setProperty("/deptBarCount", Math.max(deptBars.length, 1));

            var typeBars = this._bars(maintRows, function (r) { return r.type ? that._tr("mtype", r.type) : that._t("noType"); });
            m.setProperty("/maintTypeBars", typeBars);
            m.setProperty("/maintBarCount", Math.max(typeBars.length, 1));

            // Current assignments, with the date of the latest assignment to the current holder
            m.setProperty("/assignments", rows.filter(function (a) { return a.status === "Assigned"; }).map(function (a) {
                var last = ledger.filter(function (l) {
                    return l.assetId === a.asset_ID && l.toId === a.holderId;
                })[0];
                return { assetTag: a.assetTag, model: a.model, holder: a._holder, department: a._department,
                    location: a._location, since: that._date((last && last.transitionDate) || a.firstDistributionDate) };
            }).sort(function (x, y) { return String(x.assetTag).localeCompare(String(y.assetTag)); }));

            m.setProperty("/history", ledger.map(function (l) {
                return { date: that._date(l.transitionDate), assetTag: byId[l.assetId].assetTag,
                    action: that._tr("action", l.action), from: l.fromName || "-",
                    to: l.toName || "-", notes: l.notes || "" };
            }));

            m.setProperty("/maintenance", open.concat(maintRows.filter(function (r) { return !isOpen(r); })).map(function (r) {
                var days = isOpen(r) && r.reportedDate ? Math.max(Math.floor((now - new Date(r.reportedDate).getTime()) / DAY), 0) : "";
                return { assetTag: byId[r.assetId].assetTag, type: that._tr("mtype", r.type),
                    statusText: that._tr("mstatus", r.status),
                    state: isOpen(r) ? (days !== "" && days > 7 ? "Error" : "Warning") : "Success",
                    vendor: r.vendorName || "", reported: that._date(r.reportedDate),
                    daysOpen: String(days), completed: that._date(r.completedDate) };
            }));

            m.setProperty("/summary", [
                { metric: this._t("kpiTotal"),         value: String(total),         context: kpiText.total },
                { metric: this._t("kpiAssigned"),      value: String(assigned),      context: kpiText.assigned },
                { metric: this._t("kpiAvailable"),     value: String(available),     context: kpiText.available },
                { metric: this._t("kpiMaintenance"),   value: String(maint),         context: kpiText.maintenance },
                { metric: this._t("kpiOpenMaint"),     value: String(open.length),   context: kpiText.openMaint },
                { metric: this._t("kpiAssignments30"), value: String(assignments30), context: kpiText.assignments30 }
            ]);

            this._buildNotifications(rows, overdue);
        },

        _buildNotifications: function (rows, overdue) {
            var today = iso(new Date()), soon = iso(new Date(Date.now() + 30 * DAY));
            var expiring = rows.filter(function (a) {
                return a.warrantyExpiry && a.warrantyExpiry >= today && a.warrantyExpiry <= soon &&
                    (a.status === "In Stock" || a.status === "Assigned" || a.status === "Maintenance");
            }).length;

            var list = this._posted.slice();
            if (overdue)  { list.push({ title: this._t("notifMaint", [overdue]),     desc: this._t("notifMaintDesc"),    icon: "sap-icon://wrench", state: "Warning", time: "" }); }
            if (expiring) { list.push({ title: this._t("notifWarranty", [expiring]), desc: this._t("notifWarrantyDesc"), icon: "sap-icon://shield", state: "Warning", time: "" }); }

            var m = this.getView().getModel("dash");
            m.setProperty("/notifications", list);
            m.setProperty("/notifCount", String(list.length));
        },

        _filterSummary: function () {
            var f = this.getView().getModel("dash").getProperty("/filters"), parts = [];
            if (f.from || f.to) { parts.push(this._t("filterDate") + ": " + (f.from ? this._dateFmt.format(f.from) : "...") + " - " + (f.to ? this._dateFmt.format(f.to) : "...")); }
            if (f.status)     { parts.push(this._t("filterStatus") + ": " + this._tr("status", f.status)); }
            if (f.category)   { parts.push(this._t("filterCategory") + ": " + f.category); }
            if (f.location)   { parts.push(this._t("filterLocation") + ": " + f.location); }
            if (f.department) { parts.push(this._t("filterDepartment") + ": " + f.department); }
            return parts.length ? parts.join("; ") : this._t("noFilters");
        },

        // Navigate like the launchpad tiles do: intent <SemanticObject>-manage inside the launchpad,
        // otherwise open the target app directly.
        _navigate: function (semanticObject, params) {
            var u = window.sap && sap.ushell;
            if (u && u.Container && u.Container.getServiceAsync) {
                var target = { target: { semanticObject: semanticObject, action: "manage" }, params: params || {} };
                u.Container.getServiceAsync("Navigation").then(function (nav) {
                    return nav.navigate(target);
                }).catch(function () {
                    return u.Container.getServiceAsync("CrossApplicationNavigation").then(function (nav) {
                        nav.toExternal(target);
                    });
                });
            } else if (APP_URLS[semanticObject]) {
                mobileLibrary.URLHelper.redirect(APP_URLS[semanticObject], false);
            }
        },

        onFilterChange: function () { this._refresh(); },

        onClear: function () {
            this.getView().getModel("dash").setProperty("/filters",
                { status: "", category: "", location: "", department: "", from: null, to: null });
            this._refresh();
        },

        onRefresh: function () { this._load(); },

        onLanguageChange: function (oEvent) {
            var url = new URL(window.location.href);
            url.searchParams.set("sap-language", oEvent.getSource().getSelectedKey());
            window.location.href = url.toString();
        },

        onKpiPress: function (status) {
            this._navigate("Assets", status ? { status: status } : {});
        },

        onAssetRowPress: function (oEvent) {
            var row = oEvent.getSource().getBindingContext("dash").getObject();
            this._navigate("Assets", { assetTag: row.assetTag });
        },

        onMaintenancePress: function () {
            this._navigate("Maintenance", {});
        },

        onOpenNotifications: function (oEvent) {
            var that = this, source = oEvent.getSource();
            if (!this._notifPopover) {
                this._notifPopover = Fragment.load({
                    id: this.getView().getId(),
                    name: "managerdashboard.view.Notifications",
                    controller: this
                }).then(function (pop) {
                    that.getView().addDependent(pop);
                    return pop;
                });
            }
            this._notifPopover.then(function (pop) { pop.openBy(source); });
        },

        // FR-023 (revised): share the current report as an in-app notification instead of email.
        // Session-only for now; nothing is persisted on the backend.
        onNotify: function () {
            this._posted.unshift({
                title: this._t("notifReportTitle"),
                desc: this._t("notifReportDesc", [this._rows.length, this._filterSummary()]),
                icon: "sap-icon://pdf-attachment",
                state: "Success",
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            });
            this._refresh();
            MessageToast.show(this._t("notifyDone"));
        },

        onDownloadPdf: function () {
            var that = this, m = this.getView().getModel("dash");
            var now = new Date();
            var pdf = new PdfReport();

            pdf.text(this._t("pdfTitle"), { size: 16, bold: true })
               .text(this._t("pdfGenerated", [this._dateTimeFmt.format(now)]))
               .text(this._t("pdfRole"))
               .text(this._t("pdfFilters", [this._filterSummary()]))
               .line().space(4);

            pdf.text(this._t("summaryTitle"), { size: 12, bold: true })
               .table([{ header: this._t("colMetric"), width: 0.35 }, { header: this._t("colValue"), width: 0.2 }, { header: this._t("colContext"), width: 0.45 }],
                   m.getProperty("/summary").map(function (r) { return [r.metric, r.value, r.context]; }))
               .space(10);

            pdf.text(this._t("assignmentsTitle") + " (" + m.getProperty("/assignments").length + ")", { size: 12, bold: true })
               .table([
                   { header: this._t("colAsset"),      width: 0.15 },
                   { header: this._t("colModel"),      width: 0.22 },
                   { header: this._t("colHolder"),     width: 0.2 },
                   { header: this._t("colDepartment"), width: 0.17 },
                   { header: this._t("colLocation"),   width: 0.12 },
                   { header: this._t("colSince"),      width: 0.14 }
               ], m.getProperty("/assignments").map(function (a) {
                   return [a.assetTag, a.model, a.holder, a.department, a.location, a.since];
               }))
               .space(10);

            pdf.text(this._t("maintenanceTitle") + " (" + m.getProperty("/maintenance").length + ")", { size: 12, bold: true })
               .table([
                   { header: this._t("colAsset"),     width: 0.15 },
                   { header: this._t("colType"),      width: 0.16 },
                   { header: this._t("colStatus"),    width: 0.15 },
                   { header: this._t("colVendor"),    width: 0.2 },
                   { header: this._t("colReported"),  width: 0.14 },
                   { header: this._t("colDaysOpen"),  width: 0.08 },
                   { header: this._t("colCompleted"), width: 0.12 }
               ], m.getProperty("/maintenance").map(function (r) {
                   return [r.assetTag, r.type, r.statusText, r.vendor, r.reported, r.daysOpen, r.completed];
               }))
               .space(10);

            pdf.text(this._t("pdfAssetList", [this._rows.length]), { size: 12, bold: true })
               .table([
                   { header: this._t("colAsset"),         width: 0.14 },
                   { header: this._t("colModel"),         width: 0.22 },
                   { header: this._t("colSerial"),        width: 0.14 },
                   { header: this._t("filterCategory"),   width: 0.13 },
                   { header: this._t("filterStatus"),     width: 0.12 },
                   { header: this._t("filterDepartment"), width: 0.13 },
                   { header: this._t("filterLocation"),   width: 0.12 }
               ], this._rows.map(function (a) {
                   return [a.assetTag, a.model, a.serialNumber, a._category, that._tr("status", a.status), a._department, a._location];
               }));

            pdf.download("asset-report-" + iso(now) + ".pdf", this._t("pdfTitle") + " - " + this._dateTimeFmt.format(now));
            MessageToast.show(this._t("pdfDone"));
        }
    });
});
