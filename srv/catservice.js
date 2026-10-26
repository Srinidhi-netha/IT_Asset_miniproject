const cds = require("@sap/cds");
const { randomUUID } = require('crypto');

module.exports = cds.service.impl(async function () {

    const {DepartmentSrv} = this.entities;
    const {EmployeeSrv} = this.entities;
    const {AssetCategorieSrv} = this.entities;
    const {VendorSrv} = this.entities;
    const {AssetSrv} = this.entities;
    const {OwnershipLedgerSrv} = this.entities;
    const {MaintenanceRecordSrv} = this.entities;
    const {ArchiveRecordSrv} = this.entities;
        const {AssetRequestSrv} = this.entities;
    const { Employees: EmpDb, Assets: AssetDb, AssetRequests: ReqDb, Notifications: NotifDb } = cds.entities('It_Asset');
    this.before(['CREATE', 'UPDATE'], EmployeeSrv, (req) => {
    if (req.data.email) req.data.email = req.data.email.trim().toLowerCase();
});
this.before('READ', '*', (req) => {
    console.log('USER ID:', req.user.id, '| ENTITY:', req.target?.name);
});

this.before(['createEmployee', 'updateEmployee'], (req) => {
    if (req.data.email) req.data.email = req.data.email.trim().toLowerCase();
});

        this.on('assign', AssetSrv, async (req) => {
        const key = req.params[0];
        const assetId = (typeof key === 'object') ? key.asset_ID : key;
        const { employee, notes } = req.data;
        const tx = cds.tx(req);

        if (!employee) return req.error(400, 'Please select an employee.');

        const asset = await tx.run(SELECT.one.from(AssetSrv).where({ asset_ID: assetId }));
        if (!asset) return req.error(404, 'Asset not found.');
        if (asset.status !== 'In Stock') {
            return req.error(409, `Only assets with status "In Stock" can be assigned. This asset is "${asset.status}".`);
        }

        const emp = await tx.run(SELECT.one.from(EmployeeSrv).where({ employee_ID: employee }));
        if (!emp) return req.error(404, 'Employee not found.');
        if (String(emp.status).toLowerCase() !== 'active') {
            return req.error(409, `${emp.fullName} is not an active employee and cannot receive an asset.`);
        }

        const today = new Date().toISOString().slice(0, 10);

        await tx.run(UPDATE(AssetSrv).set({
            status: 'Assigned',
            currentHolder_employee_ID: employee,
            firstDistributionDate: asset.firstDistributionDate || today
        }).where({ asset_ID: assetId }));

        await tx.run(INSERT.into(OwnershipLedgerSrv).entries({
            ledger_ID: randomUUID(),
            asset_asset_ID: assetId,
            fromEmployee_employee_ID: null,
            toEmployee_employee_ID: employee,
            action: 'Assign',
            transitionDate: today,
            notes: notes || null
        }));

        return tx.run(SELECT.one.from(AssetSrv).where({ asset_ID: assetId }));
    });

         this.on('returnAsset', AssetSrv, async (req) => {
        const key = req.params[0];
        const assetId = (typeof key === 'object') ? key.asset_ID : key;
        const { notes } = req.data;
        const tx = cds.tx(req);

        const asset = await tx.run(SELECT.one.from(AssetSrv).where({ asset_ID: assetId }));
        if (!asset) return req.error(404, 'Asset not found.');
        if (asset.status !== 'Assigned') {
            return req.error(409, `Only assets with status "Assigned" can be returned. This asset is "${asset.status}".`);
        }

        const today = new Date().toISOString().slice(0, 10);
        const previousHolder = asset.currentHolder_employee_ID;

        await tx.run(UPDATE(AssetSrv).set({
            status: 'In Stock',
            currentHolder_employee_ID: null
        }).where({ asset_ID: assetId }));

        await tx.run(INSERT.into(OwnershipLedgerSrv).entries({
            ledger_ID: randomUUID(),
            asset_asset_ID: assetId,
            fromEmployee_employee_ID: previousHolder,
            toEmployee_employee_ID: null,
            action: 'Return',
            transitionDate: today,
            notes: notes || null
        }));

        return tx.run(SELECT.one.from(AssetSrv).where({ asset_ID: assetId }));
    });

        this.on('sendToMaintenance', AssetSrv, async (req) => {
        const key = req.params[0];
        const assetId = (typeof key === 'object') ? key.asset_ID : key;
        const { type, vendor, description } = req.data;
        const tx = cds.tx(req);

        if (!type) return req.error(400, 'Please select a maintenance type.');
        const TYPES = ['Repair', 'Preventive', 'Upgrade', 'Warranty Claim', 'Inspection'];
        const typeValue = TYPES.find(t => t.toLowerCase() === String(type).trim().toLowerCase());
        if (!typeValue) return req.error(400, `Maintenance type must be one of: ${TYPES.join(', ')}.`);
        const asset = await tx.run(SELECT.one.from(AssetSrv).where({ asset_ID: assetId }));

        if (!asset) return req.error(404, 'Asset not found.');
        if (asset.status !== 'In Stock' && asset.status !== 'Assigned') {
            return req.error(409, `Only assets that are "In Stock" or "Assigned" can be sent to maintenance. This asset is "${asset.status}".`);
        }

        const today = new Date().toISOString().slice(0, 10);
        const coveredByWarranty = !!(asset.warrantyExpiry && asset.warrantyExpiry >= today
            && (typeValue === 'Repair' || typeValue === 'Warranty Claim'));

        await tx.run(INSERT.into(MaintenanceRecordSrv).entries({
            maintenance_ID: randomUUID(),
            asset_asset_ID: assetId,
            type: typeValue,
             reportedBy_employee_ID: asset.currentHolder_employee_ID || null,
            serviceVendor_vendor_ID: vendor || null,
            reportedDate: today,
            status: 'Open',
            coveredByWarranty: coveredByWarranty,
            description: description || null
        }));

        await tx.run(UPDATE(AssetSrv).set({ status: 'Maintenance' }).where({ asset_ID: assetId }));

        return tx.run(SELECT.one.from(AssetSrv).where({ asset_ID: assetId }));
    });

    this.on('completeMaintenance', AssetSrv, async (req) => {
        const key = req.params[0];
        const assetId = (typeof key === 'object') ? key.asset_ID : key;
        const { outcome, cost, notes } = req.data;
        const tx = cds.tx(req);

        if (!outcome) return req.error(400, 'Please select an outcome.');
                const OUTCOMES = ['Fixed', 'Part Replaced', 'Beyond Repair'];
        const outcomeValue = OUTCOMES.find(o => o.toLowerCase() === String(outcome).trim().toLowerCase());
        if (!outcomeValue) return req.error(400, `Outcome must be one of: ${OUTCOMES.join(', ')}.`);


        const asset = await tx.run(SELECT.one.from(AssetSrv).where({ asset_ID: assetId }));
        if (!asset) return req.error(404, 'Asset not found.');
        if (asset.status !== 'Maintenance') {
            return req.error(409, `Only assets in "Maintenance" can be completed. This asset is "${asset.status}".`);
        }

        const open = await tx.run(
            SELECT.one.from(MaintenanceRecordSrv)
                .where({ asset_asset_ID: assetId, status: { in: ['Open', 'In Progress'] } })
                .orderBy('reportedDate desc')
        );
        if (!open) return req.error(409, 'No open maintenance record was found for this asset.');

        const today = new Date().toISOString().slice(0, 10);

        await tx.run(UPDATE(MaintenanceRecordSrv).set({
            status: 'Completed',
            completedDate: today,
            outcome: outcomeValue,
            cost: (cost === undefined || cost === null) ? null : cost,
            description: [open.description, notes].filter(Boolean).join(' | ') || null
        }).where({ maintenance_ID: open.maintenance_ID }));

        const holder = asset.currentHolder_employee_ID;

        if (outcomeValue === 'Beyond Repair')  {
            await tx.run(UPDATE(AssetSrv).set({
                status: 'Retired',
                currentHolder_employee_ID: null
            }).where({ asset_ID: assetId }));

            await tx.run(INSERT.into(OwnershipLedgerSrv).entries({
                ledger_ID: randomUUID(),
                asset_asset_ID: assetId,
                fromEmployee_employee_ID: holder || null,
                toEmployee_employee_ID: null,
                action: 'Retire',
                transitionDate: today,
                notes: 'Beyond repair'
            }));
        } else {
            await tx.run(UPDATE(AssetSrv).set({
                status: holder ? 'Assigned' : 'In Stock'
            }).where({ asset_ID: assetId }));
        }

        return tx.run(SELECT.one.from(AssetSrv).where({ asset_ID: assetId }));
    });

        this.on('retire', AssetSrv, async (req) => {
        const key = req.params[0];
        const assetId = (typeof key === 'object') ? key.asset_ID : key;
        const { notes } = req.data;
        const tx = cds.tx(req);

        const asset = await tx.run(SELECT.one.from(AssetSrv).where({ asset_ID: assetId }));
        if (!asset) return req.error(404, 'Asset not found.');
        if (asset.status !== 'In Stock') {
            return req.error(409, `Only assets that are "In Stock" can be retired. Return or complete work on this asset first. It is currently "${asset.status}".`);
        }

        const today = new Date().toISOString().slice(0, 10);

        await tx.run(UPDATE(AssetSrv).set({ status: 'Retired' }).where({ asset_ID: assetId }));

        await tx.run(INSERT.into(OwnershipLedgerSrv).entries({
            ledger_ID: randomUUID(),
            asset_asset_ID: assetId,
            fromEmployee_employee_ID: null,
            toEmployee_employee_ID: null,
            action: 'Retire',
            transitionDate: today,
            notes: notes || null
        }));

        return tx.run(SELECT.one.from(AssetSrv).where({ asset_ID: assetId }));
    });

        

    this.on('archive', AssetSrv, async (req) => {
        const key = req.params[0];
        const assetId = (typeof key === 'object') ? key.asset_ID : key;
        const { reason, disposalMethod, disposalCertNo } = req.data;
        const tx = cds.tx(req);

        const REASONS = ['End of Life', 'Obsolete', 'Beyond Repair', 'Lost'];
        const METHODS = ['Recycle', 'Donate', 'Sell', 'Destroy'];

        const reasonValue = REASONS.find(r => r.toLowerCase() === String(reason || '').trim().toLowerCase());
        if (!reasonValue) return req.error(400, `Reason must be one of: ${REASONS.join(', ')}.`);

        const methodValue = METHODS.find(m => m.toLowerCase() === String(disposalMethod || '').trim().toLowerCase());
        if (!methodValue) return req.error(400, `Disposal method must be one of: ${METHODS.join(', ')}.`);

        const asset = await tx.run(SELECT.one.from(AssetSrv).where({ asset_ID: assetId }));
        if (!asset) return req.error(404, 'Asset not found.');
        if (asset.status !== 'Retired') {
            return req.error(409, `Only "Retired" assets can be archived. This asset is "${asset.status}".`);
        }

        await tx.run(INSERT.into(ArchiveRecordSrv).entries({
            archive_ID: randomUUID(),
            asset_asset_ID: assetId,
            archivedAt: new Date().toISOString(),
            reason: reasonValue,
            disposalMethod: methodValue,
            disposalCertNo: disposalCertNo || null
        }));

        await tx.run(UPDATE(AssetSrv).set({ status: 'Archived' }).where({ asset_ID: assetId }));

        return tx.run(SELECT.one.from(AssetSrv).where({ asset_ID: assetId }));
    });

     this.before('DELETE', AssetCategorieSrv, async (req) => {
        const id = req.data.category_ID;
        if (!id) return;
        const used = await cds.tx(req).run(SELECT.one.from(AssetSrv).where({ category_category_ID: id }));
        if (used) return req.error(409, 'This category is used by existing assets and cannot be deleted.');
    });
 
    this.before('DELETE', VendorSrv, async (req) => {
        const id = req.data.vendor_ID;
        if (!id) return;
        const used = await cds.tx(req).run(SELECT.one.from(AssetSrv).where({ vendor_vendor_ID: id }));
        if (used) return req.error(409, 'This vendor is used by existing assets and cannot be deleted.');
    });

        this.before('DELETE', DepartmentSrv, async (req) => {
        const id = req.data.dept_ID;
        if (!id) return;
        const used = await cds.tx(req).run(SELECT.one.from(EmployeeSrv).where({ department_dept_ID: id }));
        if (used) {
            return req.error(409, 'This department still has employees and cannot be deleted. Reassign the employees first.');
        }
    });
 

     this.on('createDepartment', async(request, response) =>{
            //Step 2: Get the data which is coming from the API
            const deptData = request.data;
     
            //Step 3: Instantiate the transaction object
            const objTransaction = cds.tx(request);
     
            //Step 4: Insert the record into database
            let returnData = await objTransaction.run([
                INSERT.into(DepartmentSrv).entries(deptData)
            ]).then((resolve, reject) => {
                if(typeof(resolve) !== undefined){
                    return request.data
                } else{
                    request.error(500, "Error in inserting data into the database")
                }
            }).catch(err => {
                request.error("There is an error : ", err.toString())
            })
     
            //Step 5: Return the data
            return returnData;
        })

        this.on('createEmployee', async(request, response) =>{
            //Step 2: Get the data which is coming from the API
            const deptData = request.data;
     
            //Step 3: Instantiate the transaction object
            const objTransaction = cds.tx(request);
     
            //Step 4: Insert the record into database
            let returnData = await objTransaction.run([
                INSERT.into(EmployeeSrv).entries(deptData)
            ]).then((resolve, reject) => {
                if(typeof(resolve) !== undefined){
                    return request.data
                } else{
                    request.error(500, "Error in inserting data into the database")
                }
            }).catch(err => {
                request.error("There is an error : ", err.toString())
            })
     
            //Step 5: Return the data
            return returnData;
        })

        this.on('createAssetCategory', async(request, response) =>{
            //Step 2: Get the data which is coming from the API
            const deptData = request.data;
     
            //Step 3: Instantiate the transaction object
            const objTransaction = cds.tx(request);
     
            //Step 4: Insert the record into database
            let returnData = await objTransaction.run([
                INSERT.into(AssetCategorieSrv).entries(deptData)
            ]).then((resolve, reject) => {
                if(typeof(resolve) !== undefined){
                    return request.data
                } else{
                    request.error(500, "Error in inserting data into the database")
                }
            }).catch(err => {
                request.error("There is an error : ", err.toString())
            })
     
            //Step 5: Return the data
            return returnData;
        })

        this.on('createVendor', async(request, response) =>{
            //Step 2: Get the data which is coming from the API
            const deptData = request.data;
     
            //Step 3: Instantiate the transaction object
            const objTransaction = cds.tx(request);
     
            //Step 4: Insert the record into database
            let returnData = await objTransaction.run([
                INSERT.into(VendorSrv).entries(deptData)
            ]).then((resolve, reject) => {
                if(typeof(resolve) !== undefined){
                    return request.data
                } else{
                    request.error(500, "Error in inserting data into the database")
                }
            }).catch(err => {
                request.error("There is an error : ", err.toString())
            })
     
            //Step 5: Return the data
            return returnData;
        })

        this.on('createAsset', async(request, response) =>{
            //Step 2: Get the data which is coming from the API
            const deptData = request.data;
     
            //Step 3: Instantiate the transaction object
            const objTransaction = cds.tx(request);
     
            //Step 4: Insert the record into database
            let returnData = await objTransaction.run([
                INSERT.into(AssetSrv).entries(deptData)
            ]).then((resolve, reject) => {
                if(typeof(resolve) !== undefined){
                    return request.data
                } else{
                    request.error(500, "Error in inserting data into the database")
                }
            }).catch(err => {
                request.error("There is an error : ", err.toString())
            })
     
            //Step 5: Return the data
            return returnData;
        })

        this.on('createOwnershipLedger', async(request, response) =>{
            //Step 2: Get the data which is coming from the API
            const deptData = request.data;
     
            //Step 3: Instantiate the transaction object
            const objTransaction = cds.tx(request);
     
            //Step 4: Insert the record into database
            let returnData = await objTransaction.run([
                INSERT.into(OwnershipLedgerSrv).entries(deptData)
            ]).then((resolve, reject) => {
                if(typeof(resolve) !== undefined){
                    return request.data
                } else{
                    request.error(500, "Error in inserting data into the database")
                }
            }).catch(err => {
                request.error("There is an error : ", err.toString())
            })
     
            //Step 5: Return the data
            return returnData;
        })

        this.on('createMaintenanceRecord', async(request, response) =>{
            //Step 2: Get the data which is coming from the API
            const deptData = request.data;
     
            //Step 3: Instantiate the transaction object
            const objTransaction = cds.tx(request);
     
            //Step 4: Insert the record into database
            let returnData = await objTransaction.run([
                INSERT.into(MaintenanceRecordSrv).entries(deptData)
            ]).then((resolve, reject) => {
                if(typeof(resolve) !== undefined){
                    return request.data
                } else{
                    request.error(500, "Error in inserting data into the database")
                }
            }).catch(err => {
                request.error("There is an error : ", err.toString())
            })
     
            //Step 5: Return the data
            return returnData;
        })

        this.on('createArchiveRecord', async(request, response) =>{
            //Step 2: Get the data which is coming from the API
            const deptData = request.data;
     
            //Step 3: Instantiate the transaction object
            const objTransaction = cds.tx(request);
     
            //Step 4: Insert the record into database
            let returnData = await objTransaction.run([
                INSERT.into(ArchiveRecordSrv).entries(deptData)
            ]).then((resolve, reject) => {
                if(typeof(resolve) !== undefined){
                    return request.data
                } else{
                    request.error(500, "Error in inserting data into the database")
                }
            }).catch(err => {
                request.error("There is an error : ", err.toString())
            })
     
            //Step 5: Return the data
            return returnData;
        })

        // Update APIs: change the record identified by its key, return the updated row(s)
        const updates = {
            updateDepartment:        [DepartmentSrv,        'dept_ID'],
            updateEmployee:          [EmployeeSrv,          'employee_ID'],
            updateAssetCategory:     [AssetCategorieSrv,    'category_ID'],
            updateVendor:            [VendorSrv,            'vendor_ID'],
            updateAsset:             [AssetSrv,             'asset_ID'],
            updateOwnershipLedger:   [OwnershipLedgerSrv,   'ledger_ID'],
            updateMaintenanceRecord: [MaintenanceRecordSrv, 'maintenance_ID'],
            updateArchiveRecord:     [ArchiveRecordSrv,     'archive_ID']
        };
        for (const [action, [entity, keyName]] of Object.entries(updates)) {
            this.on(action, async (request) => {
                const { [keyName]: id, ...changes } = request.data;
                if (!id) return request.error(400, `${keyName} is required.`);
                Object.keys(changes).forEach(k => changes[k] === undefined && delete changes[k]);

                const objTransaction = cds.tx(request);
                const count = await objTransaction.run(UPDATE(entity).set(changes).where({ [keyName]: id }));
                if (!count) return request.error(404, `No record found for ${keyName} ${id}.`);

                return objTransaction.run(SELECT.from(entity).where({ [keyName]: id }));
            });
        }

        this.on('deleteDepartment', async(request, response) => {
                const {
                    dept_ID
                } = request.data;
         
                try {
                    const objTransaction = cds.tx(request);
         
                    await objTransaction.delete(DepartmentSrv).where({
                        dept_ID:dept_ID
                    })
         
                    return "Successfully deleted.";
                } catch (error) {
                    request.error("Error : ",error)
                }
         
            })

            this.on('deleteEmpoyee', async(request, response) => {
                const {
                    employee_ID
                } = request.data;
         
                try {
                    const objTransaction = cds.tx(request);
         
                    await objTransaction.delete(EmployeeSrv).where({
                        employee_ID:employee_ID
                    })
         
                    return "Successfully deleted.";
                } catch (error) {
                    request.error("Error : ",error)
                }
         
            })

            this.on('deleteAssetCategory', async(request, response) => {
                const {
                    category_ID
                } = request.data;
         
                try {
                    const objTransaction = cds.tx(request);
         
                    await objTransaction.delete(AssetCategorieSrv).where({
                        category_ID:category_ID
                    })
         
                    return "Successfully deleted.";
                } catch (error) {
                    request.error("Error : ",error)
                }
         
            })

            this.on('deleteVendor', async(request, response) => {
                const {
                    vendor_ID
                } = request.data;
         
                try {
                    const objTransaction = cds.tx(request);
         
                    await objTransaction.delete(VendorSrv).where({
                        vendor_ID:vendor_ID
                    })
         
                    return "Successfully deleted.";
                } catch (error) {
                    request.error("Error : ",error)
                }
         
            })

            this.on('deleteAsset', async(request, response) => {
                const {
                    asset_ID
                } = request.data;
         
                try {
                    const objTransaction = cds.tx(request);
         
                    await objTransaction.delete(AssetSrv).where({
                        asset_ID:asset_ID
                    })
         
                    return "Successfully deleted.";
                } catch (error) {
                    request.error("Error : ",error)
                }
         
            })

            this.on('deleteOwnershipLedger', async(request, response) => {
                const {
                    ledger_ID
                } = request.data;
         
                try {
                    const objTransaction = cds.tx(request);
         
                    await objTransaction.delete(OwnershipLedgerSrv).where({
                        ledger_ID:ledger_ID
                    })
         
                    return "Successfully deleted.";
                } catch (error) {
                    request.error("Error : ",error)
                }
         
            })

            this.on('deleteMaintenanceRecord', async(request, response) => {
                const {
                    maintenance_ID
                } = request.data;
         
                try {
                    const objTransaction = cds.tx(request);
         
                    await objTransaction.delete(MaintenanceRecordSrv).where({
                        maintenance_ID:maintenance_ID
                    })
         
                    return "Successfully deleted.";
                } catch (error) {
                    request.error("Error : ",error)
                }
         
            })

            this.on('deleteArchiveRecord', async(request, response) => {
                const {
                    archive_ID
                } = request.data;
         
                try {
                    const objTransaction = cds.tx(request);
         
                    await objTransaction.delete(ArchiveRecordSrv).where({
                        archive_ID:archive_ID
                    })
         
                    return "Successfully deleted.";
                } catch (error) {
                    request.error("Error : ",error)
                }
         
            })

              // =====================  ASSET REQUESTS  =====================

    const notify = (tx, rows) => tx.run(INSERT.into(NotifDb).entries(rows.map(r => ({
        notification_ID: randomUUID(),
        isRead: false,
        createdAt: new Date().toISOString(),
        ...r
    }))));

    // Manager creates a request
    this.before('CREATE', AssetRequestSrv, async (req) => {
        const d = req.data;
        const tx = cds.tx(req);

        if (!d.employee_employee_ID || !d.asset_asset_ID) {
            return req.error(400, 'Please select an employee and an asset.');
        }

        const emp = await tx.run(SELECT.one.from(EmpDb).where({ employee_ID: d.employee_employee_ID }));
        if (!emp) return req.error(404, 'Employee not found.');
        if (String(emp.status).toLowerCase() !== 'active') {
            return req.error(409, `${emp.fullName} is not an active employee.`);
        }

        const asset = await tx.run(SELECT.one.from(AssetDb).where({ asset_ID: d.asset_asset_ID }));
        if (!asset) return req.error(404, 'Asset not found.');
        if (asset.status !== 'In Stock') {
            return req.error(409, `Only "In Stock" assets can be requested. This asset is "${asset.status}".`);
        }

        const pending = await tx.run(SELECT.one.from(ReqDb).where({ asset_asset_ID: d.asset_asset_ID, status: 'Pending' }));
        if (pending) return req.error(409, `This asset already has a pending request (${pending.requestNo}).`);

        const row = await tx.run(SELECT.one.from(ReqDb).columns('count(*) as n'));
        d.request_ID = d.request_ID || randomUUID();
        d.requestNo = `REQ-${new Date().getFullYear()}-${String((row.n || 0) + 1).padStart(4, '0')}`;
        d.status = 'Pending';
        d.requestedBy = req.user.id;
        d.createdAt = new Date().toISOString();
        delete d.decidedBy;
        delete d.decidedAt;
        delete d.rejectionReason;
    });

    // Persist an in-app notification for configured Admin users after the request row exists.
    // In deployed identity setups without a configured user list, the Admin dashboard's live pending count remains the alert.
    this.after('CREATE', AssetRequestSrv, async (created, req) => {
        const d = req.data || created || {};
        const authUsers = (cds.env.requires.auth && cds.env.requires.auth.users) || {};
        const adminEmails = Object.keys(authUsers).filter(email => {
            const roles = (authUsers[email] && authUsers[email].roles) || [];
            return Array.isArray(roles) && roles.includes('Admin');
        });
        if (!adminEmails.length || !d.request_ID) return;

        const tx = cds.tx(req);
        const request = await tx.run(SELECT.one.from(ReqDb).where({ request_ID: d.request_ID }));
        if (!request) return;
        const emp = await tx.run(SELECT.one.from(EmpDb).where({ employee_ID: request.employee_employee_ID }));
        const asset = await tx.run(SELECT.one.from(AssetDb).where({ asset_ID: request.asset_asset_ID }));
        const summary = `Request ${request.requestNo}: ${emp ? emp.fullName : 'Employee'} requested ${asset ? (asset.assetTag || asset.model) : 'an asset'}.`;
        await notify(tx, adminEmails.map(recipientEmail => ({
            recipientEmail,
            request_request_ID: request.request_ID,
            title: 'New asset request',
            message: summary
        })));
    });

    // Admin approves
    this.on('approve', AssetRequestSrv, async (req) => {
        const key = req.params[0];
        const requestId = (typeof key === 'object') ? key.request_ID : key;
        const tx = cds.tx(req);

        const r = await tx.run(SELECT.one.from(ReqDb).where({ request_ID: requestId }));
        if (!r) return req.error(404, 'Request not found.');
        if (r.status !== 'Pending') return req.error(409, `This request is already ${r.status}.`);

        const asset = await tx.run(SELECT.one.from(AssetSrv).where({ asset_ID: r.asset_asset_ID }));
        if (!asset) return req.error(404, 'Asset not found.');
        if (asset.status !== 'In Stock') {
            return req.error(409, `This asset is now "${asset.status}", not "In Stock". Please reject this request.`);
        }

        const emp = await tx.run(SELECT.one.from(EmployeeSrv).where({ employee_ID: r.employee_employee_ID }));
        if (!emp) return req.error(404, 'Employee not found.');
        if (String(emp.status).toLowerCase() !== 'active') {
            return req.error(409, `${emp.fullName} is not an active employee.`);
        }

        const today = new Date().toISOString().slice(0, 10);

        await tx.run(UPDATE(AssetSrv).set({
            status: 'Assigned',
            currentHolder_employee_ID: emp.employee_ID,
            firstDistributionDate: asset.firstDistributionDate || today
        }).where({ asset_ID: asset.asset_ID }));

        await tx.run(INSERT.into(OwnershipLedgerSrv).entries({
            ledger_ID: randomUUID(),
            asset_asset_ID: asset.asset_ID,
            fromEmployee_employee_ID: null,
            toEmployee_employee_ID: emp.employee_ID,
            action: 'Assign',
            transitionDate: today,
            notes: `Approved request ${r.requestNo}`
        }));

        await tx.run(UPDATE(AssetRequestSrv).set({
            status: 'Approved',
            decidedBy: req.user.id,
            decidedAt: new Date().toISOString()
        }).where({ request_ID: requestId }));

        await notify(tx, [
            { recipientEmail: r.requestedBy, request_request_ID: requestId,
              title: 'Request approved',
              message: `Asset ${asset.assetTag || asset.asset_ID} (${asset.model}) has been assigned to ${emp.fullName}.` },
            { recipientEmail: emp.email, request_request_ID: requestId,
              title: 'Asset assigned to you',
              message: `Asset ${asset.assetTag || asset.asset_ID} (${asset.model}) has been assigned to you.` }
        ]);
    });

    // Admin rejects (reason is compulsory)
    this.on('reject', AssetRequestSrv, async (req) => {
        const key = req.params[0];
        const requestId = (typeof key === 'object') ? key.request_ID : key;
        const reason = String(req.data.reason || '').trim();
        const tx = cds.tx(req);

        if (!reason) return req.error(400, 'Please enter a reason for rejection.');

        const r = await tx.run(SELECT.one.from(ReqDb).where({ request_ID: requestId }));
        if (!r) return req.error(404, 'Request not found.');
        if (r.status !== 'Pending') return req.error(409, `This request is already ${r.status}.`);

        await tx.run(UPDATE(AssetRequestSrv).set({
            status: 'Rejected',
            rejectionReason: reason,
            decidedBy: req.user.id,
            decidedAt: new Date().toISOString()
        }).where({ request_ID: requestId }));

        await notify(tx, [
            { recipientEmail: r.requestedBy, request_request_ID: requestId,
              title: 'Request rejected',
              message: `Request ${r.requestNo} was rejected. Reason: ${reason}` }
        ]);
    });  
})