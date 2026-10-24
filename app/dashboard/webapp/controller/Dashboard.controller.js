sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/format/NumberFormat",
    "sap/base/i18n/Localization",
    "sap/m/library"
], function (Controller, JSONModel, NumberFormat, Localization, mobileLibrary) {
    "use strict";

    var DAY = 24 * 60 * 60 * 1000;
    var STATUSES = ["In Stock", "Assigned", "Maintenance", "Retired", "Archived"];

    // Same apps as the launchpad tiles (<SemanticObject>-manage). Outside a launchpad the app is opened directly.
    var APPS = [
        { so: "Assets",      url: "../assets/index.html",      icon: "sap-icon://laptop",        count: "total" },
        { so: "Employees",   url: "../employees/index.html",   icon: "sap-icon://employee",      count: "employees" },
        { so: "Departments", url: "../departments/index.html", icon: "sap-icon://org-chart",     count: "departments" },
        { so: "Categories",  url: "../categories/index.html",  icon: "sap-icon://product",       count: "categories" },
        { so: "Vendors",     url: "../vendors/index.html",     icon: "sap-icon://supplier",      count: "vendors" },
        { so: "Maintenance", url: "../maintenance/index.html", icon: "sap-icon://wrench",        count: "openMaint" },
        { so: "Archive",     url: "../archive/index.html",     icon: "sap-icon://inventory",     count: "archived" }
    ];

    function iso(d) {
        if (!d) { return ""; }
        var m = d.getMonth() + 1, day = d.getDate();
        return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (day < 10 ? "0" + day : day);
    }

    return Controller.extend("dashboard.controller.Dashboard", {

        onInit: function () {
            var that = this;
            this._assets = [];
            this._maintenance = [];
            this._masters = { employees: 0, activeEmployees: 0, departments: 0, categories: 0, vendors: 0, archiveRecords: 0 };
            this._amountFmt = NumberFormat.getFloatInstance({ minFractionDigits: 2, maxFractionDigits: 2 });

            this.getView().setModel(new JSONModel({
                busy: false, error: "", updated: "",
                language: Localization.getLanguage().slice(0, 2).toLowerCase() === "de" ? "de" : "en",
                filters: { status: "", category: "", location: "", department: "", from: null, to: null },
                options: { statuses: [], categories: [], locations: [], departments: [] },
                kpi: {}, kpiText: {},
                statusSegments: [], segmentCount: 1,
                categoryBars: [], barCount: 1,
                departmentBars: [], deptBarCount: 1,
                maintTypeBars: [], maintBarCount: 1,
                attention: [], apps: [], summary: []
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

        // Translate a backend code value (status, type, ...) when a text exists, else show it as is.
        _tr: function (prefix, value) {
            var key = prefix + "_" + String(value || "").replace(/\s/g, "");
            return value && this._bundle.hasText(key) ? this._t(key) : (value || "");
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

            Promise.all([
                this._get("AssetSrv?$select=asset_ID,assetTag,status,purchaseDate,warrantyExpiry,category_category_ID,currentHolder_employee_ID&$top=5000"),
                soft(this._get("AssetCategorieSrv?$select=category_ID,name&$top=1000")),
                soft(this._get("EmployeeSrv?$select=employee_ID,location,status,department_dept_ID&$top=5000")),
                soft(this._get("DepartmentSrv?$select=dept_ID,name&$top=1000")),
                soft(this._get("VendorSrv?$select=vendor_ID&$top=1000")),
                soft(this._get("MaintenanceRecordSrv?$select=maintenance_ID,asset_asset_ID,type,reportedDate,status,cost&$top=5000")),
                soft(this._get("ArchiveRecordSrv?$select=archive_ID&$top=5000"))
            ]).then(function (res) {
                var cats = {}, emps = {}, depts = {};
                var none = that._t("unassigned");
                res[1].forEach(function (c) { cats[c.category_ID] = c.name; });
                res[2].forEach(function (e) { emps[e.employee_ID] = e; });
                res[3].forEach(function (d) { depts[d.dept_ID] = d.name; });

                that._assets = res[0].map(function (a) {
                    var h = emps[a.currentHolder_employee_ID];
                    a._category   = cats[a.category_category_ID] || that._t("noCategory");
                    a._location   = (h && h.location) || none;
                    a._department = (h && depts[h.department_dept_ID]) || none;
                    return a;
                });
                that._maintenance = res[5];
                that._masters = {
                    employees: res[2].length,
                    activeEmployees: res[2].filter(function (e) { return String(e.status).toLowerCase() === "active"; }).length,
                    departments: res[3].length,
                    categories: res[1].length,
                    vendors: res[4].length,
                    archiveRecords: res[6].length
                };

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
            var rows = this._filteredRows(), none = this._t("unassigned"), ms = this._masters;

            var count = function (s) { return rows.filter(function (a) { return a.status === s; }).length; };
            var total = rows.length, available = count("In Stock"), assigned = count("Assigned"),
                maint = count("Maintenance"), retired = count("Retired"), archived = count("Archived");
            var pct = function (n) { return total ? Math.round(n * 100 / total) : 0; };

            var locs = {};
            rows.forEach(function (a) { if (a._location !== none) { locs[a._location] = true; } });
            var locCount = Object.keys(locs).length;

            var ids = {};
            rows.forEach(function (a) { ids[a.asset_ID] = true; });
            var maintRows = this._maintenance.filter(function (r) { return ids[r.asset_asset_ID]; });
            var open = maintRows.filter(function (r) { return r.status === "Open" || r.status === "In Progress"; });
            var cutoff = Date.now() - 7 * DAY;
            var attention = open.filter(function (r) {
                return r.reportedDate && new Date(r.reportedDate).getTime() < cutoff;
            }).length;
            var cost = maintRows.reduce(function (sum, r) { return sum + (parseFloat(r.cost) || 0); }, 0);

            var today = iso(new Date()), soon = iso(new Date(Date.now() + 30 * DAY));
            var warranty = rows.filter(function (a) {
                return a.warrantyExpiry && a.warrantyExpiry >= today && a.warrantyExpiry <= soon &&
                    (a.status === "In Stock" || a.status === "Assigned" || a.status === "Maintenance");
            }).length;

            var kpi = {
                total: total, available: available, assigned: assigned, maintenance: maint, retired: retired, archived: archived,
                employees: ms.employees, departments: ms.departments, categories: ms.categories, vendors: ms.vendors,
                openMaint: open.length, warranty: warranty
            };
            var kpiText = {
                total:       this._t("ctxLocations",   [locCount]),
                available:   this._t("ctxInventory",   [pct(available)]),
                assigned:    this._t("ctxUtilization", [pct(assigned)]),
                maintenance: this._t("ctxAttention",   [attention]),
                retired:     this._t("ctxArchive",     [retired]),
                archived:    this._t("ctxArchiveRecords", [ms.archiveRecords]),
                employees:   this._t("ctxActiveEmployees", [ms.activeEmployees]),
                openMaint:   this._t("ctxMaintCost",   [this._amountFmt.format(cost)])
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

            var catBars = this._bars(rows, function (a) { return a._category; });
            m.setProperty("/categoryBars", catBars);
            m.setProperty("/barCount", Math.max(catBars.length, 1));

            var deptBars = this._bars(rows.filter(function (a) { return a._department !== none; }), function (a) { return a._department; });
            m.setProperty("/departmentBars", deptBars);
            m.setProperty("/deptBarCount", Math.max(deptBars.length, 1));

            var typeBars = this._bars(maintRows, function (r) { return r.type ? that._tr("mtype", r.type) : that._t("noType"); });
            m.setProperty("/maintTypeBars", typeBars);
            m.setProperty("/maintBarCount", Math.max(typeBars.length, 1));

            m.setProperty("/attention", [
                { title: this._t("attMaintTitle", [attention]), desc: this._t("attMaintDesc"),
                  icon: "sap-icon://wrench", so: "Maintenance", params: {} },
                { title: this._t("attArchiveTitle", [retired]), desc: this._t("attArchiveDesc"),
                  icon: "sap-icon://inventory", so: "Assets", params: { status: "Retired" } },
                { title: this._t("attWarrantyTitle", [warranty]), desc: this._t("attWarrantyDesc"),
                  icon: "sap-icon://shield", so: "Assets", params: {} }
            ]);

            m.setProperty("/apps", APPS.map(function (app) {
                return { title: that._t("app" + app.so), desc: that._t("app" + app.so + "Desc"), icon: app.icon,
                    info: String(kpi[app.count]), so: app.so, params: {} };
            }));

            m.setProperty("/summary", [
                { metric: this._t("kpiTotal"),       value: String(total),        context: kpiText.total },
                { metric: this._t("kpiAvailable"),   value: String(available),    context: kpiText.available },
                { metric: this._t("kpiAssigned"),    value: String(assigned),     context: kpiText.assigned },
                { metric: this._t("kpiMaintenance"), value: String(maint),        context: kpiText.maintenance },
                { metric: this._t("kpiRetired"),     value: String(retired),      context: kpiText.retired },
                { metric: this._t("kpiArchived"),    value: String(archived),     context: kpiText.archived },
                { metric: this._t("kpiOpenMaint"),   value: String(open.length),  context: kpiText.openMaint },
                { metric: this._t("kpiWarranty"),    value: String(warranty),     context: this._t("ctxWithin30") },
                { metric: this._t("kpiEmployees"),   value: String(ms.employees), context: kpiText.employees },
                { metric: this._t("kpiDepartments"), value: String(ms.departments), context: "" },
                { metric: this._t("kpiCategories"),  value: String(ms.categories),  context: "" },
                { metric: this._t("kpiVendors"),     value: String(ms.vendors),     context: "" }
            ]);
        },

        // Navigate like the launchpad tiles do: intent <SemanticObject>-manage inside the launchpad,
        // otherwise open the target app directly.
        _navigate: function (semanticObject, params) {
            var app = APPS.filter(function (a) { return a.so === semanticObject; })[0];
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
            } else if (app) {
                mobileLibrary.URLHelper.redirect(app.url, false);
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

        onAppPress: function (semanticObject) {
            this._navigate(semanticObject, {});
        },

        onListNavPress: function (oEvent) {
            var item = oEvent.getSource().getBindingContext("dash").getObject();
            this._navigate(item.so, item.params);
        }
    });
});
