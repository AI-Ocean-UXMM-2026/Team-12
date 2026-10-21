# Source PRD text extraction

This is a reading aid extracted from `PRD.docx`, including tables in document order. The DOCX remains the authoritative supplied source. Implementation defaults and conflict resolutions are in `IMPLEMENTATION_PLAN.md`.

Product Requirements Document (PRD)

Parcel Delivery Management & Tracking System

1. Product Overview

1.1 Purpose

The Parcel Delivery Management & Tracking System enables customers to track their parcels, update their preferred receiving locations, and provide delivery instructions. Riders can view their assigned delivery routes, access parcel details, update delivery statuses, upload delivery photos, and receive notifications. Administrators can manage Rider information, create parcel records, generate tracking codes, and assign parcels to Riders.

The system aims to improve delivery transparency, streamline delivery operations, reduce unsuccessful delivery attempts, and provide accurate delivery status information to customers and internal users.

1.2 Product Objectives

Enable customers to track parcels using a tracking code.

Allow customers to update their preferred parcel receiving location and provide delivery instructions.

Enable Riders to access daily delivery assignments and submit delivery results.

Notify Riders when customers change receiving preferences or administrators change delivery assignments.

Allow administrators to manage Riders, create parcel records, and assign parcels to Riders.

Maintain consistent parcel status information across the Customer, Rider, and Admin interfaces.

1.3 User Segments

| Segment | Primary Users | Main Responsibilities |
| --- | --- | --- |
| Customer | Parcel recipients | Track parcels, change receiving locations, provide instructions, and view delivery status |
| Rider | Delivery personnel | View assigned parcels, follow delivery routes, update delivery results, and upload delivery photos |
| Admin Panel | Operations administrators | Manage Riders, create parcel records, generate tracking codes, and assign parcels to Riders |

1.4 Scope

In Scope

Parcel tracking

Customer receiving-location changes

Customer delivery instructions

Customer-facing delivery status updates

Rider daily route and parcel lists

Rider parcel details and delivery-result submission

Rider notifications

Rider management

Parcel information management

Tracking-code generation

Parcel assignment to Riders

Expected delivery-date calculation

Out of Scope for This Version

The following functions are not specified in the supplied requirements and require further product-owner confirmation before being included in the implementation scope:

Online payment processing

Customer account registration and login

Live GPS tracking

Route optimization and automatic route planning

Automated SMS, email, or messaging integrations

Parcel returns and refund processing

Proof-of-delivery signatures

Reporting and analytics dashboards

2. Customer Segment

2.1 Customer Function 1: Track Parcel and check parcel status

Requirement ID

CUS-01

Business Requirement

Customers can check their parcel delivery status through the website by entering the parcel tracking code.

Functional Requirements

The customers receive parcel tracking code.

The website will contain a tracking-code input field.

Customers shall be able to enter a tracking code and submit a tracking request.

The system shall validate the entered tracking code.

If the tracking code exists, the system shall display the corresponding parcel's latest available delivery status.

The system will display only the tracking information associated with the entered code.

Customer-Facing Statuses

| Status | Description |
| --- | --- |
| Processing Delivery | The parcel is being created by admin (Parcel Module). |
| On the Way | The parcel is being assigned with Rider by admin (Assign Rider Module) |
| Delivered | The rider updated the delivery status in the delivery route module. |
| Delay | Delivery has been delayed and the parcel has not been delivered as expected. |

UI Requirements

Tracking Code Input

Track Button

Parcel Status:

Processing Delivery,

On the Way

Delivered

Delay

Error Message for Invalid Tracking Code

Acceptance Criteria

Given a valid tracking code, when the customer submits it, the system displays the corresponding parcel status.

Given an invalid tracking code, when the customer submits it, the system displays an error message.

When the parcel status is updated, the tracking page displays the latest status available in the system.

2.2 Customer Function 2: Change Receiving Place

Requirement ID

CUS-02

Business Requirement

Customers can change their preferred parcel receiving location to provide alternative delivery instructions when they cannot receive the parcel personally.

Functional Requirements

The system shall allow customers to select an available receiving option.

The supported receiving options shall include:

Receive at Home

Leave with Neighbour

Leave at Door

The system shall save the customer's selected receiving option against the relevant parcel.

The system shall make the updated receiving preference available to the assigned Rider.

The system shall notify the Rider when the customer changes the receiving preference, subject to the notification rules ({Customer Name or Business Name} changed receiving option for {Parcel Code}.)

The system shall apply the updated preference to the relevant parcel only.

Customer can write instruction for the receiving option change.

UI Requirements

Receiving Place Selection

Receive at Home

Leave with Neighbour

Leave at Door

Save Button

Write Instruction (textbox)

Acceptance Criteria

Given a parcel eligible for receiving-place changes, the customer can select and save an available option.

After a successful update, the system displays the new receiving option.

The assigned Rider can view the updated option.

The system generates a Rider notification when the receiving option changes.

The system prevents an update from being applied to the wrong parcel.

Customers can enter and save delivery instructions.

The assigned Rider can view the instructions.

3. Rider Segment

3.1 Rider Function 1: View Daily Route

Requirement ID

DRV-01

Business Requirement

Riders can view their assigned delivery routes and the list of parcels they need to deliver on a selected date.

Functional Requirements

The system shall allow Riders to access their assigned delivery parcels.

Riders shall be able to filter delivery assignments by date and parcel code.

Riders shall be able to open a parcel to view its detailed delivery information.

The system shall allow Riders to update delivery status by uploading with photo from the parcel detail view.

The system shall restrict Riders to viewing and updating authorized delivery assignments.

The rider updated status shall be reflected in customer tracking view.

A. List View

The list view shall contain the following information:

| Field | Description |
| --- | --- |
| Customer Name | Name of the parcel recipient |
| Customer Contact Number | Recipient's phone number |
| Township | Delivery township |
| Parcel Code | Unique parcel identifier |
| Status | Current delivery status |

List View Actions

Filter assignments by date and parcel code

Open parcel details.

Copy the customer's contact number through a copy action.

Review the current delivery status.

B. Detail View

The detail view shall contain the following information:

| Field | Description |
| --- | --- |
| Customer Name | Recipient's name |
| Customer Contact Number | Recipient's contact number |
| Township | Delivery township |
| Parcel Code | Unique parcel identifier |
| Address Detail | Full delivery address |
| Customer Receive Place | Customer's preferred receiving option |
| Delivery Instruction | Additional instructions provided by the customer |
| Upload Photo | Upload the delivery photo, where applicable |
| Status | Select or update the delivery result |
| Submit Button | Save the delivery-result changes |

C. Rider Delivery-Result Statuses

The status dropdown shall provide the following options:

| Rider Status | Meaning |
| --- | --- |
| Customer Unreachable | The Rider could not contact or reach the customer to complete delivery. |
| Delivered | The parcel was delivered to the customer at home. |
| Delivered to Neighbour | The parcel was delivered to a neighbour. |
| Leave at Door | The parcel was left at the designated door or drop-off location. |

D. Delivery Photo Requirements

The system shall provide an upload control in the parcel detail view.

Riders shall be able to select and upload a delivery photo.

The uploaded photo shall be associated with the relevant parcel and delivery assignment.

The photo shall be saved when the submission succeeds.

The system shall display an appropriate validation message if the upload fails.

File type should be Jpeg or Png format, only 1 photo can be uploaded, file size should not exceed 10 MB.

Acceptance Criteria

The Rider can filter assigned parcels by date and parcel code.

The list view displays the required parcel information.

The Rider can copy the customer's contact number.

The Rider can open the detail view and access the delivery address, receiving options, and instructions.

The Rider can select one of the defined delivery-result statuses.

The Rider can upload a delivery photo according to the configured rules.

After successful submission, the updated delivery result is saved and reflected in the customer-facing tracking information.

The system prevents unauthorized Riders from updating parcels that are not assigned to them.

3.2 Rider Function 2: Receive Notifications

Requirement ID

DRV-02

Business Requirement

Riders receive notifications when customers change their preferred receiving place or delivery instructions.

Functional Requirements

The system shall provide a notification entry point represented by a bell icon.

The system shall generate a notification when a customer changes a parcel's receiving option with instruction.

Riders shall be able to open a notification and view its associated information.

The system shall provide a notification list view.

Riders shall be able to filter notifications by date and parcel code.

A. Notification List View

The list view shall contain:

| Field | Description |
| --- | --- |
| Date | Delivery Date |
| Parcel Code | System will generate automatically when admin create the parcel |
| Receive Place | Updated customer receiving option |
| Instruction | Updated Customer’s receiving instruction |
| Customer Name | Recipient's name |
| Customer Contact Number | Recipient's phone number |

B. Notification Filters

Date

Parcel Code

C. Notification Triggers

| Trigger | Expected System Behaviours |
| --- | --- |
| Customer changes receiving place | Generate a notification for the relevant assigned Rider. |

Acceptance Criteria

A notification is generated when a customer changes the receiving preference.

The notification list displays the required parcel and customer information.

Riders can filter notifications by date and parcel code.

A notification links to the correct parcel information.

4. Admin Panel Segment

4.1 Admin Function 1: Manage Rider List

Requirement ID

ADM-01

Business Requirement

Administrators can create and maintain rider records, including Rider names, contact information, and vehicle details.

Functional Requirements

The system shall allow administrators to create Rider records.

The system shall allow administrators to view the Rider list.

The system shall allow administrators to view Rider details.

The system shall allow administrators to edit existing Rider information.

The system shall validate required fields before saving a Rider record.

The system shall make valid Rider records available for parcel assignment.

The system shall prevent incomplete or invalid Rider information from being saved where required fields are missing.

Rider Information Fields

| Field | Description | Requirement |
| --- | --- | --- |
| Rider Name | Rider's name | Required |
| Contact Number | Rider's phone number | Required |
| Vehicle Type | Type of delivery vehicle; Delivery Van; Car; Bicycle | Required |
| Vehicle Number | Vehicle registration or identifying number; (Textbox) | Optional |

Admin Actions

Create Rider

View Rider List

View Rider Details

Edit Rider Information

Deactivate Rider

Acceptance Criteria

An administrator can create a Rider record with valid required information.

The saved Rider appears in the Rider list.

An administrator can view and update existing Rider information.

The system validates missing or invalid required fields.

Valid Rider records are available when assigning parcels.

4.2 Admin Function 2: Create Parcel Information

Requirement ID

ADM-02

Business Requirement

Administrators can create parcel records, maintain sender and recipient information, enter parcel and payment details and generate tracking codes.

Functional Requirements

The system shall allow administrators to create a parcel record.

The system shall generate a unique parcel code automatically.

The system shall allow administrators to enter sender information.

The system shall allow administrators to enter recipient information.

The system shall allow administrators to enter payment type – Prepaid , COD

The system shall allow administrators to enter delivery-related remarks.

The system shall generate a tracking code for customer parcel tracking.

The system shall allow administrators to view the generated tracking code.

The system shall associate the tracking code with the correct parcel record.

The system shall make the tracking code available for communication to the customer.

The system shall validate required parcel information before saving the record.

A. Parcel Information — From

| Field | Description | Requirement |
| --- | --- | --- |
| Parcel Code | Unique system-generated parcel identifier | System-generated |
| Business/Person Name | Sender's business or personal name | Required |
| Received Date | Date the parcel is received by the delivery business | Required |
| Received Person | Person who received or registered the parcel | Required |

B. Parcel Information — To

| Field | Description | Requirement |
| --- | --- | --- |
| Customer Name | Recipient's name | Required |
| Contact Number | Recipient's phone number | Required |
| Payment Type | Payment arrangement for the order by drop-down; Prepaid; COD | Required |
| Order Amount | Total order amount | Required according to payment type as COD |
| Delivery Fee | Delivery charge | Required |
| Township | Recipient's township | Required |
| Address | Recipient's full delivery address | Required |
| Delivery Note | Additional parcel or delivery notes | Optional |

C. Payment Type

The payment-type field shall provide the following options:

Prepaid

Cash on Delivery (COD)

The system shall save the selected payment type with the parcel record.

Parcel List View shall contain;

| Field | Description |
| --- | --- |
| Parcel Code | System will generate automatically when admin create the parcel |
| Customer Name | Recipient's name |
| Customer Contact Number | Recipient's phone number |
| Payment Type | Prepaid or COD |
| Status | Rider updated status shall be reflected mentioned in the section 3.1  C |

D. Tracking-Code Generation

The system shall generate a tracking code when creating the parcel record successfully.

Each tracking code shall uniquely identify its associated parcel.

The generated tracking code shall be visible to authorized administrators.

The tracking code shall be usable on the customer-facing tracking page.

The system shall send the tracking code to the customer via SMS channel.

The tracking code shall not be duplicated across different parcels.

E. Parcel Record Management

The system shall allow administrators to access saved parcel information for operational purposes, including Rider assignment.

Acceptance Criteria

An administrator can create a parcel record with valid required information.

The system generates a unique parcel code.

The system saves the sender and recipient details correctly.

The administrator can select Prepaid or COD as the payment type.

The system generates a unique tracking code and displays it to the administrator.

The tracking code retrieves the correct parcel on the customer tracking page.

The system makes the tracking code available for customer communication.

4.3 Admin Function 3: Assign Parcel to Rider

Requirement ID

ADM-03

Business Requirement

Administrators can assign parcels to Riders based on delivery dates and maintain parcel assignment information for operational tracking.

Functional Requirements

The system shall allow administrators to view parcels available for assignment.

Administrators shall be able to select a parcel code.

Administrators shall be able to select a Rider.

Administrators shall be able to set or confirm the assignment date.

Administrators shall be able to set the delivery date.

The system shall save the parcel-to-Rider assignment.

The system shall associate the assigned parcel with the selected Rider and delivery date.

The assigned parcel shall appear in the Rider's daily route list for the relevant date.

The system shall display the parcel's delivery status in the assignment list.

The system shall support access to the delivered photo in the assignment detail view when one is available.

The system shall calculate the expected delivery date according to the approved business rule. (3 Days)

A. Assignment Information

| Field | Description |
| --- | --- |
| Parcel Code | Identifier of the parcel to be assigned |
| Rider | Selected Rider responsible for delivery |
| Assign Date | Date the parcel is assigned to a Rider |
| Delivery Date | Scheduled delivery date |
| Status | Current delivery status - Rider updated status shall be reflected mentioned in the section 3.1  C |

B. List View

The assignment list shall display:

Parcel Code

Assigned Rider

Assign Date

Delivery Date

Status

C. Detail View

The assignment detail view shall provide access to:

Parcel Code

Rider

Assign Date

Delivery Date

Current Status

D. Expected Delivery-Date Calculation

The supplied requirement states that the expected delivery date should be calculated based on the Assign Date and a three-day period.

For the initial specification, the proposed interpretation is:

Expected Delivery Date = Delivery Date + 3 calendar days.

Acceptance Criteria

An administrator can select a parcel and assign it to a valid Rider.

The parcel appears in the assigned Rider's daily route list.

The assignment list displays the parcel's current status.

The system calculates the expected delivery date according to the approved rule.

5. Cross-Functional Business Rules

5.1 Parcel and Tracking-Code Management

Each parcel shall have a unique parcel code.

Each parcel shall have a unique tracking code.

The tracking code shall be linked to one parcel record.

Customers shall use the tracking code to retrieve their parcel status.

Administrators shall be able to view the tracking code.

Tracking information shall reflect the latest successfully saved status.

5.2 Delivery Status Management

The system shall distinguish between customer-facing delivery statuses and Rider delivery-result statuses.

Customer-Facing Statuses

Processing Delivery

On the Way

Delivered

Delay

Rider Delivery-Result Statuses

Customer Unreachable

Delivered Home

Delivered to Neighbour

Leave at Door

Note: "Delivered Home" or "Delivered to Neighbor" or “Leave at door” same meaning as Delivered.

"Customer Unreachable" means the delivered unsuccessful.

5.3 Receiving Place and Instructions

Receiving-place changes shall be associated with the correct parcel.

Additional instructions shall be stored with the correct parcel.

Riders shall have access to the latest saved receiving preference and instructions.

Changes to receiving preferences or instructions shall trigger the defined notifications.

5.4 Rider Assignment

A parcel shall be assigned to an identifiable Rider.

The assigned Rider shall see the parcel in the relevant daily route list.

Access to parcel details and delivery-result updates shall be restricted to authorized users.

5.5 Delivery Evidence

Delivery photos shall be associated with the relevant parcel.

The system shall store uploaded photos securely.

The delivered photo shall be accessible in the assignment detail view when available.

6. Non-Functional Requirements

6.1 Security and Access Control

Customer tracking shall expose only information intended for the tracking-code holder.

Riders shall access only the parcel assignments they are authorized to manage.

Administrators shall have the permissions required to manage Riders, parcels, and assignments.

The system shall validate user permissions before saving changes.

Personal information and delivery photos shall be protected against unauthorized access.

6.2 Data Integrity

Parcel codes and tracking codes shall be unique.

Parcel assignments shall reference valid parcel and Rider records.

Delivery status changes shall be saved consistently.

Receiving-place changes and instructions shall remain associated with the correct parcel.

The system shall prevent incomplete submissions from creating inconsistent records.

6.3 Usability

Customer tracking shall be simple and easy to understand.

Rider views shall make important delivery information easy to locate.

Contact-number copying shall require minimal interaction.

Forms shall provide clear validation and error messages.

Delivery statuses shall use consistent labels across relevant screens.

6.4 Performance and Reliability

The system should return tracking results within an agreed response-time target.

The system should support multiple customers and Riders using the system concurrently.

Failed submissions should provide clear feedback and avoid unintended duplicate updates.

The system should preserve successfully saved parcel information and delivery results.

Specific response-time targets, availability targets, data-retention periods, and supported-device requirements require technical and product-owner agreement.
