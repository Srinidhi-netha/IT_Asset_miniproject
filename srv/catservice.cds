using {It_Asset as database} from '../db/schema';
using { IT_Asset.common as common } from '../db/common';


service CatalogService{
        

   entity DepartmentSrv as projection on database.Departments;

    entity EmployeeSrv as projection on database.Employees;

    entity AssetCategorieSrv as projection on database.AssetCategories;
    entity VendorSrv as projection on database.Vendors;

    entity AssetSrv as projection on database.Assets {
    *,
    case
        when status = 'In Stock'    then 3
        when status = 'Assigned'    then 5
        when status = 'Maintenance' then 2
        when status = 'Retired'     then 1
        else 0
    end as statusCriticality : Integer,
    case when status = 'In Stock' then true else false end as canAssign : Boolean,
    case when status = 'Assigned' then true else false end as canReturn : Boolean,
    case when status = 'In Stock' or status = 'Assigned' then true else false end as canSendToMaintenance : Boolean,
    case when status = 'Maintenance' then true else false end as canCompleteMaintenance : Boolean,
    case when status = 'In Stock' then true else false end as canRetire : Boolean,
    case when status = 'Retired' then true else false end as canArchive : Boolean
} actions {
    @cds.odata.bindingparameter.name : '_it'
    @Core.OperationAvailable : { $edmJson : { $Path : '_it/canAssign' } }
    @Common.SideEffects : {
        TargetProperties : ['_it/status', '_it/currentHolder_employee_ID', '_it/statusCriticality', '_it/canAssign', '_it/canReturn', '_it/canSendToMaintenance', '_it/canCompleteMaintenance', '_it/canRetire', '_it/canArchive'],
        TargetEntities   : ['_it/ownershipHistory']
    }
    action assign(
        employee : UUID @(
            title : 'Assign To',
            Common.ValueList : {
                CollectionPath : 'EmployeeSrv',
                Parameters     : [
                    { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : employee, ValueListProperty : 'employee_ID' },
                    { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'fullName' },
                    { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'location' }
                ]
            }
        ),
        notes : String(255) @title : 'Notes'
    ) returns AssetSrv;

    @cds.odata.bindingparameter.name : '_it'
    @Core.OperationAvailable : { $edmJson : { $Path : '_it/canReturn' } }
    @Common.SideEffects : {
        TargetProperties : ['_it/status', '_it/currentHolder_employee_ID', '_it/statusCriticality', '_it/canAssign', '_it/canReturn', '_it/canSendToMaintenance', '_it/canCompleteMaintenance', '_it/canRetire', '_it/canArchive'],
        TargetEntities   : ['_it/ownershipHistory']
    }
    action returnAsset(
        notes : String(255) @title : 'Return Notes'
    ) returns AssetSrv;

    @cds.odata.bindingparameter.name : '_it'
    @Core.OperationAvailable : { $edmJson : { $Path : '_it/canSendToMaintenance' } }
    @Common.SideEffects : {
        TargetProperties : ['_it/status', '_it/statusCriticality', '_it/canAssign', '_it/canReturn', '_it/canSendToMaintenance', '_it/canCompleteMaintenance', '_it/canRetire', '_it/canArchive'],
        TargetEntities   : ['_it/maintenanceRecords']
    }
    action sendToMaintenance(
        type : String(50) @title : 'Type (Repair, Preventive, Upgrade, Warranty Claim, Inspection)',
        vendor : UUID @(
            title : 'Service Vendor',
            Common.ValueList : {
                CollectionPath : 'VendorSrv',
                Parameters     : [
                    { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : vendor, ValueListProperty : 'vendor_ID' },
                    { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'name' }
                ]
            }
        ),
        description : String(255) @title : 'Description'
    ) returns AssetSrv;

    @cds.odata.bindingparameter.name : '_it'
    @Core.OperationAvailable : { $edmJson : { $Path : '_it/canCompleteMaintenance' } }
    @Common.SideEffects : {
        TargetProperties : ['_it/status', '_it/currentHolder_employee_ID', '_it/statusCriticality', '_it/canAssign', '_it/canReturn', '_it/canSendToMaintenance', '_it/canCompleteMaintenance', '_it/canRetire', '_it/canArchive'],
        TargetEntities   : ['_it/maintenanceRecords', '_it/ownershipHistory']
    }
    action completeMaintenance(
        outcome : String(50) @title : 'Outcome (Fixed, Part Replaced, Beyond Repair)',
        cost    : Decimal(15,2) @title : 'Cost',
        notes   : String(255)   @title : 'Notes'
    ) returns AssetSrv;

    @cds.odata.bindingparameter.name : '_it'
    @Core.OperationAvailable : { $edmJson : { $Path : '_it/canRetire' } }
    @Common.SideEffects : {
        TargetProperties : ['_it/status', '_it/statusCriticality', '_it/canAssign', '_it/canReturn', '_it/canSendToMaintenance', '_it/canCompleteMaintenance', '_it/canRetire', '_it/canArchive'],
        TargetEntities   : ['_it/ownershipHistory']
    }
    action retire(
        notes : String(255) @title : 'Retirement Notes'
    ) returns AssetSrv;

    @cds.odata.bindingparameter.name : '_it'
    @Core.OperationAvailable : { $edmJson : { $Path : '_it/canArchive' } }
    @Common.SideEffects : {
        TargetProperties : ['_it/status', '_it/statusCriticality', '_it/canAssign', '_it/canReturn', '_it/canSendToMaintenance', '_it/canCompleteMaintenance', '_it/canRetire', '_it/canArchive'],
        TargetEntities   : ['_it/archiveRecords']
    }
    action archive(
        reason         : String(50) @title : 'Reason (End of Life, Obsolete, Beyond Repair, Lost)',
        disposalMethod : String(50) @title : 'Disposal Method (Recycle, Donate, Sell, Destroy)',
        disposalCertNo : String(40) @title : 'Disposal Certificate No.'
    ) returns AssetSrv;
};
    
    annotate CatalogService.AssetSrv with @odata.draft.enabled;
    
    annotate CatalogService.AssetCategorieSrv with @odata.draft.enabled;
    annotate CatalogService.VendorSrv         with @odata.draft.enabled;
    annotate CatalogService.EmployeeSrv   with @odata.draft.enabled;
    annotate CatalogService.DepartmentSrv with @odata.draft.enabled;
  
 

    entity OwnershipLedgerSrv as projection on database.OwnershipLedgers;
    entity MaintenanceRecordSrv as projection on database.MaintenanceRecords;
    entity ArchiveRecordSrv as projection on database.ArchiveRecords;
        entity AssetRequestSrv as projection on database.AssetRequests actions {
        action approve();
        action reject(reason : String(200));
    };

    entity NotificationSrv as projection on database.Notifications;

    // Read-only employee list for managers (no access to the full employee master data)
    @readonly @cds.redirection.target: false
    entity EmployeeLookupSrv as projection on database.Employees {
        key employee_ID,
            fullName,
            email,
            phone,
            location,
            status,
            department.name as departmentName
    };

    // Flattened view of requests for the dashboards
    @readonly @cds.redirection.target: false
    entity AssetRequestOverviewSrv as projection on database.AssetRequests {
        key request_ID,
            requestNo,
            status,
            justification,
            neededBy,
            requestedBy,
            createdAt,
            decidedAt,
            rejectionReason,
            employee.employee_ID     as employeeId,
            employee.fullName        as employeeName,
            employee.email           as employeeEmail,
            employee.location        as employeeLocation,
            employee.department.name as employeeDepartment,
            asset.asset_ID           as assetId,
            asset.assetTag           as assetTag,
            asset.model              as assetModel
    };

    // Read-only views for the dashboards: names are flattened in, so managers and users
    // need no access to the employee, department, category and vendor master data.
    @readonly @cds.redirection.target: false
    entity AssetOverviewSrv as projection on database.Assets {
        key asset_ID,
            assetTag,
            serialNumber,
            model,
            purchaseDate,
            warrantyExpiry,
            firstDistributionDate,
            status,
            category.name                  as categoryName,
            vendor.name                    as vendorName,
            currentHolder.employee_ID      as holderId,
            currentHolder.fullName         as holderName,
            currentHolder.email            as holderEmail,
            currentHolder.location         as holderLocation,
            currentHolder.department.name  as holderDepartment
    };

    @readonly @cds.redirection.target: false
entity AssetHistorySrv as projection on database.OwnershipLedgers {
    key ledger_ID,
        asset.asset_ID           as assetId,
        asset.assetTag           as assetTag,
        action,
        transitionDate,
        fromEmployee.employee_ID as fromId,
        fromEmployee.fullName    as fromName,
        fromEmployee.email       as fromEmail,
        toEmployee.employee_ID   as toId,
        toEmployee.fullName      as toName,
        toEmployee.email         as toEmail,
        notes,
        createdAt
};
    @readonly @cds.redirection.target: false
    entity MaintenanceOverviewSrv as projection on database.MaintenanceRecords {
        key maintenance_ID,
            asset.asset_ID                 as assetId,
            asset.assetTag                 as assetTag,
            asset.currentHolder.email      as holderEmail,
            reportedBy.email          as reporterEmail,
            type,
            status,
            outcome,
            reportedDate,
            completedDate,
            serviceVendor.name             as vendorName
    };
annotate CatalogService.MaintenanceOverviewSrv with @(restrict: [
    { grant: 'READ', to: ['Admin', 'Manager'] },
    { grant: 'READ', to: 'User', where: 'holderEmail = $user or reporterEmail = $user' }
]);
    // The signed-in user's own employee record (matched by e-mail / login name)
    @readonly @cds.redirection.target: false
    entity MyProfileSrv as projection on database.Employees {
        key employee_ID,
            fullName,
            email,
            location,
            department.name                as departmentName
    };

    action createDepartment(
        dept_ID     : common.Guid,
        name        : common.String100,
        costCenter  : common.String50,
    )returns array of DepartmentSrv;

    action updateDepartment(
        dept_ID     : common.Guid,
        name        : common.String100,
        costCenter  : common.String50,
    )returns array of DepartmentSrv;

    action deleteDepartment(
        dept_ID     : common.Guid,
        
    )returns String;

    action createEmployee(
        employee_ID : common.Guid,

        fullName    : common.String120,
        email       : common.String120,
        phone       : String(20),
        location    : common.String100,
        status      : String(30),
        department_dept_ID  : common.Guid
    )returns array of EmployeeSrv;

    action updateEmployee(
        employee_ID : common.Guid,

        fullName    : common.String120,
        email       : common.String120,
        phone       : String(20),
        location    : common.String100,
        status      : String(30),
        department_dept_ID  : common.Guid
    )returns array of EmployeeSrv;

    action deleteEmpoyee(
        employee_ID : common.Guid
    )returns String;

    action createAssetCategory(
        category_ID   : common.Guid,
        name          : common.String100,
        lifespanMonths: Integer,
    )returns array of AssetCategorieSrv;

    action updateAssetCategory(
        category_ID   : common.Guid,
        name          : common.String100,
        lifespanMonths: Integer,
    )returns array of AssetCategorieSrv;

    action deleteAssetCategory(
        category_ID   : common.Guid,
    )returns String;

    action createVendor(
        vendor_ID   : common.Guid,
        name        : common.String120,
        email       : common.String120,
    )returns array of VendorSrv;

    action updateVendor(
        vendor_ID   : common.Guid,
        name        : common.String120,
        email       : common.String120,
    )returns array of VendorSrv;

    action deleteVendor(
        vendor_ID   : common.Guid,
    )returns String;

    action createAsset(
        asset_ID              : common.Guid,
        assetTag              : common.String50,
        serialNumber          : common.String100,
        model                 : common.String100,
        purchaseDate          : Date,
        purchaseCost          : Decimal(15,2),
        warrantyExpiry        : Date,
        firstDistributionDate : Date,
        status                : String(30),
        category_category_ID  : common.Guid,
        vendor_vendor_ID      : common.Guid,
        currentHolder_employee_ID  : common.Guid,
    
    )returns array of AssetSrv;

    action updateAsset(
        asset_ID              : common.Guid,
        assetTag              : common.String50,
        serialNumber          : common.String100,
        model                 : common.String100,
        purchaseDate          : Date,
        purchaseCost          : Decimal(15,2),
        warrantyExpiry        : Date,
        firstDistributionDate : Date,
        status                : String(30),
        category_category_ID  : common.Guid,
        vendor_vendor_ID      : common.Guid,
        currentHolder_employee_ID : common.Guid,
    
    )returns array of AssetSrv;

    action deleteAsset(
        asset_ID              : common.Guid,
        
    
    )returns String;

    action createOwnershipLedger(
        ledger_ID       : common.Guid,

        asset_asset_ID  : common.Guid,
        fromEmployee_employee_ID   : common.Guid,
        toEmployee_employee_ID     : common.Guid,
        action          : common.String50,
        transitionDate  : Date,
        recordedBy_employee_ID  : common.Guid,
        notes           : LargeString,
        
    )returns array of OwnershipLedgerSrv;

    action updateOwnershipLedger(
        ledger_ID       : common.Guid,

        asset_asset_ID  : common.Guid,
        fromEmployee_employee_ID : common.Guid,
        toEmployee_employee_ID   : common.Guid,
        action          : common.String50,
        transitionDate  : Date,
        recordedBy_employee_ID  : common.Guid,
        notes           : LargeString,
        
    )returns array of OwnershipLedgerSrv;

    action deleteOwnershipLedger(
        ledger_ID       : common.Guid,

    )returns String;

    action createMaintenanceRecord (
        maintenance_ID     : common.Guid,
        asset_asset_ID     : common.Guid,
        type               : common.String50,
        reportedBy_employee_ID  : common.Guid,
        serviceVendor_vendor_ID : common.Guid,
        reportedDate       : Date,
        completedDate      : Date,
        status             : String(30),
        outcome            : common.String255,
        cost               : Decimal(15,2),
        coveredByWarranty  : Boolean,
        nextDueDate        : Date,
        description        : LargeString,
    ) returns array of MaintenanceRecordSrv;

    action updateMaintenanceRecord (
        maintenance_ID     : common.Guid,
        asset_asset_ID     : common.Guid,
        type               : common.String50,
        reportedBy_employee_ID   : common.Guid,
        serviceVendor_vendor_ID  : common.Guid,
        reportedDate       : Date,
        completedDate      : Date,
        status             : String(30),
        outcome            : common.String255,
        cost               : Decimal(15,2),
        coveredByWarranty  : Boolean,
        nextDueDate        : Date,
        description        : LargeString,
    ) returns array of MaintenanceRecordSrv;

    action deleteMaintenanceRecord (
        maintenance_ID     : common.Guid,
        
    ) returns String;

    action createArchiveRecord(
        archive_ID         : common.Guid,
        asset_asset_ID     : common.Guid,
        archivedAt         : Timestamp,
        archivedBy_employee_ID  : common.Guid,
        reason             : common.String255,
        disposalMethod     : common.String100,
        disposalCertNo     : common.String100,
    )returns array of ArchiveRecordSrv;

    action updateArchiveRecord(
        archive_ID         : common.Guid,
        asset_asset_ID     : common.Guid,
        archivedAt         : Timestamp,
        archivedBy_employee_ID : common.Guid,
        reason             : common.String255,
        disposalMethod     : common.String100,
        disposalCertNo     : common.String100,
    )returns array of ArchiveRecordSrv;

    action deleteArchiveRecord(
        archive_ID         : common.Guid,
        
    )returns String;

    

}

// ---------------------------------------------------------------------------
// Authorization (roles defined in xs-security.json)
//   Admin   : full CRUD and all lifecycle actions (FR-001, 003, 005, 006, 016, 017, 027)
//   Manager : read-only - assets, ownership history, maintenance and archive; no master data,
//             no admin-only actions
//   User    : read-only - own assets (current holder) with their history and maintenance
// ---------------------------------------------------------------------------

annotate CatalogService with @(requires: ['Admin', 'Manager', 'User']);

annotate CatalogService.AssetSrv with @(restrict: [
    { grant: '*',    to: 'Admin' },
    { grant: 'READ', to: 'Manager' },
    { grant: 'READ', to: 'User', where: 'currentHolder.email = $user' }
]);

annotate CatalogService.OwnershipLedgerSrv with @(restrict: [
    { grant: '*',    to: 'Admin' },
    { grant: 'READ', to: 'Manager' },
    { grant: 'READ', to: 'User', where: 'asset.currentHolder.email = $user' }
]);

annotate CatalogService.MaintenanceRecordSrv with @(restrict: [
    { grant: '*',    to: 'Admin' },
    { grant: 'READ', to: 'Manager' },
    { grant: 'READ', to: 'User', where: 'asset.currentHolder.email = $user' }
]);

annotate CatalogService.ArchiveRecordSrv with @(restrict: [
    { grant: '*',    to: 'Admin' },
    { grant: 'READ', to: 'Manager' }
]);

annotate CatalogService.EmployeeSrv       with @(restrict: [{ grant: '*', to: 'Admin' }]);
annotate CatalogService.DepartmentSrv     with @(restrict: [{ grant: '*', to: 'Admin' }]);
annotate CatalogService.AssetCategorieSrv with @(restrict: [{ grant: '*', to: 'Admin' }]);
annotate CatalogService.VendorSrv         with @(restrict: [{ grant: '*', to: 'Admin' }]);

annotate CatalogService.AssetOverviewSrv with @(restrict: [
    { grant: 'READ', to: ['Admin', 'Manager'] },
    { grant: 'READ', to: 'User', where: 'holderEmail = $user' }
]);

annotate CatalogService.AssetHistorySrv with @(restrict: [
    { grant: 'READ', to: ['Admin', 'Manager'] },
    { grant: 'READ', to: 'User', where: 'holderEmail = $user' }
]);



annotate CatalogService.MyProfileSrv with @(restrict: [
    { grant: 'READ', to: ['Admin', 'Manager', 'User'], where: 'email = $user' }
]);

// Unbound CRUD APIs bypass the entity restrictions above, so they are Admin only.
annotate CatalogService.createDepartment        with @(requires: 'Admin');
annotate CatalogService.updateDepartment        with @(requires: 'Admin');
annotate CatalogService.deleteDepartment        with @(requires: 'Admin');
annotate CatalogService.createEmployee          with @(requires: 'Admin');
annotate CatalogService.updateEmployee          with @(requires: 'Admin');
annotate CatalogService.deleteEmpoyee           with @(requires: 'Admin');
annotate CatalogService.createAssetCategory     with @(requires: 'Admin');
annotate CatalogService.updateAssetCategory     with @(requires: 'Admin');
annotate CatalogService.deleteAssetCategory     with @(requires: 'Admin');
annotate CatalogService.createVendor            with @(requires: 'Admin');
annotate CatalogService.updateVendor            with @(requires: 'Admin');
annotate CatalogService.deleteVendor            with @(requires: 'Admin');
annotate CatalogService.createAsset             with @(requires: 'Admin');
annotate CatalogService.updateAsset             with @(requires: 'Admin');
annotate CatalogService.deleteAsset             with @(requires: 'Admin');
annotate CatalogService.createOwnershipLedger   with @(requires: 'Admin');
annotate CatalogService.updateOwnershipLedger   with @(requires: 'Admin');
annotate CatalogService.deleteOwnershipLedger   with @(requires: 'Admin');
annotate CatalogService.createMaintenanceRecord with @(requires: 'Admin');
annotate CatalogService.updateMaintenanceRecord with @(requires: 'Admin');
annotate CatalogService.deleteMaintenanceRecord with @(requires: 'Admin');
annotate CatalogService.createArchiveRecord     with @(requires: 'Admin');
annotate CatalogService.updateArchiveRecord     with @(requires: 'Admin');
annotate CatalogService.deleteArchiveRecord     with @(requires: 'Admin');

// Status and holder change only through the lifecycle actions, never by editing the asset.
annotate CatalogService.AssetSrv with {
    status        @readonly;
    currentHolder @readonly;
};
annotate CatalogService.AssetRequestSrv with @(restrict: [
    { grant: '*',      to: 'Admin' },
    { grant: 'CREATE', to: 'Manager' },
    { grant: 'READ',   to: 'Manager', where: 'requestedBy = $user' }
]);

annotate CatalogService.AssetRequestOverviewSrv with @(restrict: [
    { grant: 'READ', to: 'Admin' },
    { grant: 'READ', to: 'Manager', where: 'requestedBy = $user' }
]);

annotate CatalogService.EmployeeLookupSrv with @(restrict: [
    { grant: 'READ', to: ['Admin', 'Manager'] }
]);

annotate CatalogService.NotificationSrv with @(restrict: [
    { grant: ['READ', 'UPDATE'], to: ['Admin', 'Manager', 'User'], where: 'recipientEmail = $user' }
]);
