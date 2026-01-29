import {
  GridComponent,
  ColumnsDirective,
  ColumnDirective,
  Page,
  Sort,
  Filter,
  Toolbar,
  Edit,
  Inject,
} from "@syncfusion/ej2-react-grids";
import { useAppDispatch } from "@/app/store";
import { useTickets } from "../hooks/useTickets";
import { useTicketFilters } from "../hooks/useTicketFilters";
import { openTicketDetail, openTicketForm } from "../ticket.slice";
import { Badge } from "@/components/ui/badge";
import type { Ticket } from "../types";

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  pending: "bg-orange-100 text-orange-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-purple-100 text-purple-800",
};

function StatusTemplate(props: { status: string }) {
  return (
    <Badge className={statusColors[props.status] || ""}>
      {props.status.replace("_", " ")}
    </Badge>
  );
}

function PriorityTemplate(props: { priority: string }) {
  return (
    <Badge className={priorityColors[props.priority] || ""}>
      {props.priority}
    </Badge>
  );
}

function DateTemplate(props: { createdAt: string }) {
  return <span>{new Date(props.createdAt).toLocaleDateString()}</span>;
}

export function TicketGrid() {
  const dispatch = useAppDispatch();
  const { filters } = useTicketFilters();
  const { tickets, loading, totalCount } = useTickets(filters, { page: 1, pageSize: 20 });

  const handleRowSelected = (args: { data: Ticket }) => {
    dispatch(openTicketDetail(args.data));
  };

  const handleAddClick = () => {
    dispatch(openTicketForm(null));
  };

  const toolbarClick = (args: { item: { id: string } }) => {
    if (args.item.id.includes("add")) {
      handleAddClick();
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tickets ({totalCount})</h2>
      </div>

      <GridComponent
        dataSource={tickets}
        allowPaging={true}
        allowSorting={true}
        allowFiltering={true}
        pageSettings={{ pageSize: 20, pageSizes: [10, 20, 50, 100] }}
        filterSettings={{ type: "Excel" }}
        toolbar={["Add", "Search"]}
        toolbarClick={toolbarClick}
        rowSelected={handleRowSelected}
        height="auto"
        enableHover={true}
        rowHeight={48}
        loadingIndicator={{ indicatorType: "Shimmer" }}
      >
        <ColumnsDirective>
          <ColumnDirective
            field="id"
            headerText="ID"
            width="100"
            isPrimaryKey={true}
            visible={false}
          />
          <ColumnDirective
            field="title"
            headerText="Title"
            width="250"
            clipMode="EllipsisWithTooltip"
          />
          <ColumnDirective
            field="status"
            headerText="Status"
            width="120"
            template={StatusTemplate}
          />
          <ColumnDirective
            field="priority"
            headerText="Priority"
            width="100"
            template={PriorityTemplate}
          />
          <ColumnDirective
            field="client.name"
            headerText="Client"
            width="150"
          />
          <ColumnDirective
            field="technician.name"
            headerText="Technician"
            width="150"
          />
          <ColumnDirective
            field="createdAt"
            headerText="Created"
            width="120"
            template={DateTemplate}
          />
        </ColumnsDirective>
        <Inject services={[Page, Sort, Filter, Toolbar, Edit]} />
      </GridComponent>

      {loading && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
}
