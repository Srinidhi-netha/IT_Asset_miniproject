
namespace It_Asset;

using { IT_Asset.common as common } from './common';

using { managed } from '@sap/cds/common';

//Department Entity
entity Departments : managed {
    key dept_ID     : common.Guid;
        name        : common.String100;
        costCenter  : common.String50;
        employees   : Association to many Employees on employees.department = $self;
}

//   Employee entity
entity Employees : managed {
    key employee_ID : common.Guid;

        fullName    : common.String120;
        email       : common.String120;
        phone       : String(20);
        location    : common.String100;
        status      : String(30);
        department  : Association to Departments;
        ownedAssets : Association to many Assets on ownedAssets.currentHolder = $self;
}

// Assets
entity AssetCategories : managed {
    key category_ID   : common.Guid;
        name          : common.String100;
        lifespanMonths: Integer;
        assets        : Association to many Assets  on assets.category = $self;
}

// Vendor Entity
   
entity Vendors : managed {
    key vendor_ID   : common.Guid;
        name        : common.String120;
        email       : common.String120;
        assets      : Association to many Assets on assets.vendor = $self;
}

// Assets
   
entity Assets : managed {
    key asset_ID              : common.Guid;
        assetTag              : common.String50;
        serialNumber          : common.String100;
        model                 : common.String100;
        purchaseDate          : Date;
        purchaseCost          : Decimal(15,2);
        warrantyExpiry        : Date;
        firstDistributionDate : Date;

        status                : String(30) default 'In Stock';

        category              : Association to AssetCategories;
        vendor                : Association to Vendors;
        currentHolder         : Association to Employees;
        ownershipHistory      : Association to  many OwnershipLedgers on ownershipHistory.asset = $self;
        maintenanceRecords    : Association to  many MaintenanceRecords on maintenanceRecords.asset = $self;
        archiveRecords        : Association to  many ArchiveRecords   on archiveRecords.asset = $self;
}

//Ownership Ledger
  
entity OwnershipLedgers : managed {
    key ledger_ID       : common.Guid;

        asset           : Association to Assets;
        fromEmployee    : Association to Employees;
        toEmployee      : Association to Employees;
        action          : common.String50;
        transitionDate  : Date;
        recordedBy      : Association to Employees;
        notes           : LargeString;
        
}

// Maintenance Record
   
entity MaintenanceRecords : managed {
    key maintenance_ID     : common.Guid;
        asset              : Association to Assets;
        type               : common.String50;
        reportedBy         : Association to Employees;
        serviceVendor      : Association to Vendors;
        reportedDate       : Date;
        completedDate      : Date;
        status             : String(30);
        outcome            : common.String255;
        cost               : Decimal(15,2);
        coveredByWarranty  : Boolean;
        nextDueDate        : Date;
        description        : LargeString;
}

// Archive Record
  
entity ArchiveRecords : managed {
    key archive_ID         : common.Guid;
        asset              : Association to Assets;
        archivedAt         : Timestamp;
        archivedBy         : Association to Employees;
        reason             : common.String255;
        disposalMethod     : common.String100;
        disposalCertNo     : common.String100;
}


entity AssetRequests {
  key request_ID  : UUID;
      requestNo       : String(20);
      employee        : Association to Employees;
      asset           : Association to Assets;
      justification   : String(300);
      neededBy        : Date;
      status          : String(20) default 'Pending';
      requestedBy     : String(120);
      createdAt       : Timestamp;
      decidedBy       : String(120);
      decidedAt       : Timestamp;
      rejectionReason : String(200);
}

entity Notifications {
  key notification_ID : UUID;
      recipientEmail  : String(120);
      title           : String(100);
      message         : String(300);
      request         : Association to AssetRequests;
      isRead          : Boolean default false;
      createdAt       : Timestamp;
}