using CatalogService as service from '../../srv/catservice';
annotate service.EmployeeSrv with @(
    UI.HeaderInfo : {
        TypeName       : 'Employee',
        TypeNamePlural : 'Employees',
        Title          : { Value : fullName },
        Description    : { Value : department.name }
    },
    UI.SelectionFields : [ fullName, location, status ],
    UI.LineItem : [
        { Value : fullName,        Label : 'Employee',   ![@UI.Importance] : #High },
        { Value : email,           Label : 'Email',      ![@UI.Importance] : #High },
        { Value : department.name, Label : 'Department', ![@UI.Importance] : #High },
        { Value : location,        Label : 'Location',   ![@UI.Importance] : #High },
        { Value : status,          Label : 'Status',     ![@UI.Importance] : #High }
    ],
    UI.Facets : [
        { $Type : 'UI.ReferenceFacet', ID : 'GeneralFacet', Label : 'Employee Details', Target : '@UI.FieldGroup#General' },
        { $Type : 'UI.ReferenceFacet', ID : 'AssetsFacet',  Label : 'Assigned Assets',  Target : 'ownedAssets/@UI.LineItem' }
    ],
    UI.FieldGroup #General : {
        Data : [
            { Value : fullName,           Label : 'Full Name' },
            { Value : email,              Label : 'Email' },
            { Value : phone,              Label : 'Phone' },
            { Value : location,           Label : 'Location' },
            { Value : department_dept_ID, Label : 'Department' },
            { Value : status,             Label : 'Status (Active / Inactive)' }
        ]
    }
);
 
annotate service.EmployeeSrv with {
    fullName @title : 'Employee';
    location @title : 'Location';
    status   @title : 'Status';
    department @Common.ValueList : {
        CollectionPath : 'DepartmentSrv',
        Parameters     : [
            { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : department_dept_ID, ValueListProperty : 'dept_ID' },
            { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'name' }
        ]
    };
    department @Common.Text : department.name @Common.TextArrangement : #TextOnly;
};
 