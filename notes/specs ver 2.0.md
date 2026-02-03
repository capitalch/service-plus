## 

## Service+ Executive Summary

- A comprehensive service management system for electronics repair shops with customer portal, spare parts inventory, and role-based access control on cloud.

- Post financial transactions to accounting system

- Multiple tenants.

- One tenant can have multiple business units.

- SAAS business model
  
  - Free tier
    
    - Only one business unit.
    
    - Maximum 1000 transactions allowed
  
  - Pro tier
    
    - Only one business unit
    
    - Unlimited transactions
  
  - Enterprise tier
    
    - Upto 10 business units
    
    - Unlimited transactions

---

## Technology Stack

### Client-Side

- **Core**: React + TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui + Lucide React
- **Data Layer**: GraphQL + TanStack Query + Redux
- **Routing**: TanStack Router
- **Forms**: React Hook Form + Zod validation
- **UI/UX**: Command Palette, Sonner (notifications), Framer Motion (animations)
- **Code Quality**: ESLint + Prettier + eslint-config-prettier
- **Code Generation**: GraphQL Code Generator for type safety

### Server-Side

- **Framework**: Python FastAPI
- **API**: GraphQL
- **Database**: PostgreSQL
- **Validation**: Pydantic

---

## Core Modules

### 1. Reception Management

#### 1.1 Ticket Reception

- New ticket creation and job intake
- Customer information capture
- Device/gadget details entry
- Problem description
- Initial diagnosis notes
- Photo upload feature

#### 1.2 Customer Master

- Customer database with Contact information

#### 1.3 Ticket Status Management

Transaction workflow with 3 statuses:

- **Under Process**: Active repair work
- **Waiting for Spare Parts**: Pending parts availability
- **Ready**: Completed and ready for pickup

#### 1.4 Opening Job Entry (Initial Setup)

- Bulk entry of existing tickets during software initialization

#### 1.5 Money Receipt

- Payment collection interface
- Receipt generation and printing
- Payment method tracking (cash, card, UPI, etc.)
- Partial payment support

#### 1.6 Ready Job Finalization and invoice

- Separate utility for completed jobs
- Price adjustment interface
- Final cost calculation
- Service charge finalization
- Generate final invoice

---

### 2. Spare Parts Inventory Management

#### 2.1 Master Data Setup

**Spare Parts Master**

- Part code
- Part description
- Category classification
- Unit of measurement
- Price
- GST / HSN

**Supplier Master**

- Supplier database with Contact details

**Equivalent Spare Parts**

- Define part equivalency relationships

#### 2.2 Inventory Transactions

**Opening Inventory**

- Initial stock entry during setup
- Opening balance for each part

**Purchase Invoice**

- Supplier invoice recording
- Stock inward processing

**Sale Bills**

- Direct parts sale (counter sales)
- Online sales
- Invoice generation
- Stock deduction

**Orders to Suppliers**

- Purchase order creation
- Order tracking
- Pending order management

**Booking of Spare Parts**

- Reserve parts for customers
- Reserve parts against specific tickets
- Hold inventory for confirmed requirements

**Consumption**

- Parts used in workshop/repairs against tickets

**Stock Adjustment**

- Manual stock correction
- Damaged/obsolete parts write-off
- General adjustments

#### 2.3 Inventory Reports

**All Stock Report**

- Complete inventory listing
- Current stock levels
- Stock value
- Low stock alerts

**Part Finder**

- Quick search by part code
- Search by description/keywords
- Availability check
- Location information

---

### 3. Master Setup & Configuration

#### 3.1 Service Management Setup

- Technician master 
- Job receiving types (walk-in, courier, pickup, online etc.)

#### 3.2 Print Configuration

- Job sheet format design
- Money receipt format
- Sale bill layout

#### 3.3 Company Setup

- Business unit details
- Logo and branding
- Address and contact information
- Tax registration numbers
- Terms and conditions

---

### 4. Reports & Analytics

#### 4.1 Performance Reports

**Detailed Performance Report**

- Technician-wise performance
- Job completion metrics
- Time tracking
- Quality indicators

**Summary Performance Report**

- Overview dashboard
- KPI summary
- Period-wise comparison

#### 4.2 Operational Reports

**Service Report**

- Service-wise breakdown
- Revenue by service type
- Popular repair categories

**Job Status Report**

- Current status of all tickets
- Aging analysis
- Pending jobs overview

**Cash Register**

- Daily cash transactions
- Payment mode breakdown
- Cash flow tracking

**Master Sale Report**

- Sales analytics
- Revenue trends
- Part-wise sales

---

### 5. Customer Portal

#### 5.1 Ticket Inquiry

- Track repair status by ticket number
- View estimated completion date
- Check payment status
- View repair history

#### 5.2 Customer Features (Future Enhancement)

- Online ticket creation
- Upload device images
- Communication with workshop
- Download invoices

---

## Role-Based Access Control (RBAC)

### Fixed Roles (Minimum Set)

**1. Admin**

- Full system access
- Master data management
- Configuration and setup
- All reports access
- User management

**2. Manager**

- Ticket management
- Inventory management
- Reports access (all)
- Finalization authority
- Cannot modify system configuration

**3. Receptionist**

- Ticket reception
- Money receipt
- Customer interaction
- Basic reports
- Cannot access inventory costs

**4. Technician**

- View assigned tickets
- Update job status
- Part finder access
- Consumption entry
- Limited report access

---

## Key Features & Functionality

### Cross-Cutting Features

- Real-time updates using GraphQL subscriptions
- Responsive design for tablet/mobile use
- Offline capability (progressive web app)
- Data backup and export
- Audit trail for all transactions
- Multi-branch support (future)
- Barcode/QR code support for parts and tickets

### Business Rules

- Unique ticket numbering system
- Automatic stock deduction on consumption
- Low stock alerts and notifications
- Aging analysis for pending tickets
- Warranty tracking
- Customer notification system (SMS/Email)

---

## Implementation Phases

**Phase 1: Core Service Management**

- Reception and ticket management
- Basic status workflow
- Money receipt
- Customer master

**Phase 2: Inventory Foundation**

- Parts master setup
- Opening inventory
- Basic transactions (purchase, consumption)

**Phase 3: Advanced Features**

- All inventory transactions
- Complete reporting suite
- RBAC implementation

**Phase 4: Customer Portal**

- Ticket inquiry system
- Customer self-service features

**Phase 5: Optimization**

- Performance tuning
- Advanced analytics
- Mobile app (optional)
