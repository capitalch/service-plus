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

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
