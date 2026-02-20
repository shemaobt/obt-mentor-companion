# Agent Guidelines — Frontend (obt-mentor-companion)

This document extends the [root AGENTS.md](../AGENTS.md) with frontend-specific conventions. Read both documents when working in `frontend/`.

---

## 1. Stack and Build

| Layer | Technology |
|-------|------------|
| Framework | React 18 |
| Language | TypeScript (strict mode) |
| Build | Vite |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui (Radix primitives) |
| State | TanStack React Query (server state) |
| Routing | Wouter |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Animations | Framer Motion |

**Stack constraints:**
- Use only these stack choices; do not introduce alternatives.
- No Redux or other state management libraries; use React Query for server state and React state for UI state.
- No CSS-in-JS (styled-components, emotion); use Tailwind only.
- No inline styles; use Tailwind classes.

---

## 2. Project Structure

```
frontend/
├── src/
│   ├── App.tsx               # Root component with routing
│   ├── main.tsx              # Entry point
│   ├── index.css             # Global styles and Tailwind imports
│   ├── components/           # Reusable components
│   │   ├── ui/               # shadcn/ui primitives
│   │   ├── layout/           # Layout components
│   │   └── ...               # Feature components
│   ├── pages/                # Route page components
│   │   ├── Dashboard.tsx
│   │   ├── Competencies.tsx
│   │   ├── Qualifications.tsx
│   │   └── ...
│   ├── hooks/                # Custom React hooks
│   │   ├── use-auth.ts
│   │   ├── use-competencies.ts
│   │   └── ...
│   ├── contexts/             # React contexts
│   │   └── auth-context.tsx
│   └── lib/                  # Utilities and helpers
│       ├── utils.ts          # General utilities
│       ├── queryClient.ts    # React Query client
│       └── api.ts            # API request functions
├── index.html                # HTML template
└── nginx.conf                # Nginx config for production
```

---

## 3. Component Guidelines

### Component size
- Target under **300 lines** per component
- If a component exceeds **400 lines**, split it into smaller components
- Extract logic into custom hooks when component becomes too complex

### Component structure
```typescript
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

interface ComponentProps {
  id: string;
  onAction: () => void;
}

export function ComponentName({ id, onAction }: ComponentProps) {
  const [state, setState] = useState(false);
  const { data, isLoading } = useQuery({ ... });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="flex flex-col gap-4">
      {/* Component content */}
    </div>
  );
}
```

### Rules
- Use **functional components** only; no class components
- Export named functions, not default exports (except pages)
- Define **props interface** above the component
- Keep components **pure** when possible; side effects in hooks

---

## 4. Styling with Tailwind

- Use **Tailwind classes only** for styling
- No inline `style={{ }}` attributes
- Use the `cn()` utility from `@/lib/utils` to merge conditional classes
- Use CSS variables for theme colors (defined in `index.css`)

**Examples:**

- Good:
```tsx
<div className={cn(
  "flex items-center gap-2 p-4 rounded-lg",
  isActive && "bg-primary text-primary-foreground"
)}>
```

- Bad:
```tsx
<div style={{ display: "flex", padding: "16px" }}>
```

### Responsive design
- Use mobile-first approach
- Use Tailwind breakpoints: `sm:`, `md:`, `lg:`, `xl:`
- Custom phone breakpoints available: `xs:`, `sp:`, `mp:`, `lp:`, `xp:`

---

## 5. State Management

### Server state (React Query)
- Use **TanStack React Query** for all server data
- Define queries in custom hooks in `hooks/`
- Use `queryKey` arrays for cache management
- Prefer `useQuery` for fetching, `useMutation` for updates

**Example:**
```typescript
export function useCompetencies(userId: string) {
  return useQuery({
    queryKey: ["/api/users", userId, "competencies"],
    queryFn: () => fetchCompetencies(userId),
    enabled: !!userId,
  });
}

export function useCreateCompetency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCompetency,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competencies"] });
    },
  });
}
```

### UI state
- Use `useState` for local component state
- Use `useContext` for global UI state (auth, theme)
- Avoid prop drilling; use context or composition

---

## 6. Forms

- Use **React Hook Form** with **Zod** validation
- Import Zod schemas from `@shared/schema` when available
- Use shadcn/ui form components

**Example:**
```typescript
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  level: z.number().min(1).max(5),
});

type FormData = z.infer<typeof formSchema>;

export function CompetencyForm({ onSubmit }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", level: 1 },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
}
```

---

## 7. API Requests

- Define API functions in `lib/api.ts` or feature-specific files
- Use `fetch` for HTTP requests
- Handle errors consistently with toast notifications

**Example:**
```typescript
export async function fetchCompetencies(userId: string): Promise<Competency[]> {
  const response = await fetch(`/api/users/${userId}/competencies`);
  if (!response.ok) {
    throw new Error("Failed to fetch competencies");
  }
  return response.json();
}
```

---

## 8. Type Safety

- All components must have typed props interfaces
- Use types from `@shared/schema` for data entities
- Avoid `any` type; use proper typing or `unknown` with type guards
- Use discriminated unions for component variants

**Examples:**

- Good: `interface ButtonProps { variant: "primary" | "secondary"; onClick: () => void; }`
- Bad: `function Button(props: any)`

---

## 9. Summary Checklist

- [ ] Components are under 300 lines; split if over 400.
- [ ] Functional components only; no class components.
- [ ] Tailwind classes only; no inline styles or CSS-in-JS.
- [ ] Use `cn()` utility for conditional classes.
- [ ] Server state managed with React Query.
- [ ] UI state with useState/useContext; no Redux.
- [ ] Forms use React Hook Form + Zod.
- [ ] All components have typed props interfaces.
- [ ] API functions return typed data.
- [ ] No `any` types; proper TypeScript typing throughout.

---

*Frontend guidelines for obt-mentor-companion. Built using [agents.md](https://agents.md/) format.*
