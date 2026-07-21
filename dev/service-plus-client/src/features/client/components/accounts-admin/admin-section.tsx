import { PostUnpostSection } from "./post-unpost/post-unpost-section";

type AdminGroup = 'post-unpost' | '';

type Props = {
    group: AdminGroup;
};

export function AdminSection({ group }: Props) {
    if (group === 'post-unpost' || group === '') {
        return <PostUnpostSection />;
    }
    return null;
}
