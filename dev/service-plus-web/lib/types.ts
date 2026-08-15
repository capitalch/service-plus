export interface Company {
  id: string;
  label: string;
}

export interface JobStatus {
  jobNo: string;
  jobDate: string | null;
  deliveryDate: string | null;
  isClosed: boolean;
  status: string;
  statusCode: string;
  statusDescription: string | null;
  deviceDetails: string | null;
  serialNo: string | null;
}

export interface CustomerJobs {
  customerName: string;
  jobs: JobStatus[];
}

export interface Branch {
  code: string;
  name: string;
  city: string | null;
  isHeadOffice: boolean;
}

export interface CompanyInfo {
  supportPhone: string | null;
  email: string | null;
  address: string | null;
  branchName: string;
}

export interface Part {
  id: number;
  partName: string;
  partDescription: string | null;
  price: number;
  model: string | null;
  imageUrl: string | null;
  images: string[];
  partCode: string | null;
}

export interface PartsPage {
  items: Part[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PartDetail extends Part {
  brandName: string | null;
}

export interface CartLine {
  partId: number;
  partName: string;
  price: number;
  imageUrl: string | null;
  qty: number;
}

export interface PartOrderResult {
  orderId: number;
  status: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
