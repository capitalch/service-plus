export function Footer() {
  return (
    <footer className="border-t border-border py-6">
      <div className="mx-auto max-w-5xl px-4 text-sm text-muted-foreground">
        © {new Date().getFullYear()} Service Plus. All rights reserved.
      </div>
    </footer>
  );
}
