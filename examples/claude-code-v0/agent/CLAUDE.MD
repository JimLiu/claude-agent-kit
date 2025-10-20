# Agent Development Guide

## Project Overview

**Stack**: React + JavaScript + TailwindCSS
**Environment**: SandPack browser preview
**Primary File**: [App.jsx](App.jsx) - Main development target

## Core Rules

### Focus
- Edit [App.jsx](App.jsx) for all features & UI changes
- Scaffold files (index.js, configs, package.json) → Modify only when necessary
- Keep implementation in [App.jsx](App.jsx) unless component extraction needed

### Code Style
```yaml
Components: Functional w/ hooks | Arrow functions | Props destructuring
Styling: TailwindCSS utilities only | No custom CSS
Patterns: useState/useEffect | Clean JSX | Responsive design
```

### File Structure
```
/agent
├── App.jsx          ← EDIT HERE for features/UI
├── index.js         ← React mount (rarely touch)
├── index.css        ← Tailwind imports (rarely touch)
├── package.json     ← Dependencies (add libs if needed)
└── *.config.js      ← Build configs (rarely touch)
```

## Quick Patterns

```jsx
// Component
const Feature = ({ data }) => {
  const [state, setState] = useState(null);

  return (
    <div className="flex flex-col p-4 bg-white rounded shadow">
      {/* Content */}
    </div>
  );
};

// Common utilities
{condition && <Component />}
{items.map(item => <div key={item.id}>{item.name}</div>)}
<button onClick={handleClick} className="px-4 py-2 bg-blue-500 text-white">
```

## Workflow

1. Analyze request → Identify changes in [App.jsx](App.jsx)
2. Implement → Use Tailwind classes & React patterns
3. Verify → Check responsive behavior & console errors

---
*Focus: App.jsx | React+JS+Tailwind*
