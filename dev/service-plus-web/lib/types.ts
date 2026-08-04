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
  deviceDetails: string | null;
  branchName: string | null;
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
