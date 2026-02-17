import { Button } from "@/components/ui/8bit/button";

export function Components8bit() {
    return (
        <div>
            <Button variant="default" size="default">
                Default Button
            </Button>
            <Button variant="outline" size="sm">
                Outline Button
            </Button>
            <Button variant="secondary" size="lg">
                Secondary Button
            </Button>
            <Button variant="ghost" size="icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM11.9999 7C12.5524 7 13.0999 7.44772 13.0999 8C13.0999 8.55228 12.5524 9 11.9999 9C11.4474 9 10.8999 8.55228 10.8999 8C10.8999 7.44772 11.4474 7 11.9999 7ZM12.0001 10C12.5526 10 13.1001 10.4477 13.1001 11C13.1001 11.5523 12.5526 12 12.0001 12C11.4476 12 10.9001 11.5523 10.9001 11C10.9001 10.4477 11.4476 10 12.0001 10ZM12.0002 13C12.5527 13 13.1002 13.4477 13.1002 14C13.1002 14.5523 12.5527 15 12.0002 15C11.4477 15 10.9002 14.5523 10.9002 14C10.9002 13.4477 11.4477 13 12.0002 13Z" fill="currentColor" />
                </svg>
            </Button>
        </div>
    );
}