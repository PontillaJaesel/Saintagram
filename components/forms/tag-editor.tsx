"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { LIMITS } from "@/lib/constants";
import { cleanText, normalizeList } from "@/lib/validation";

export function TagEditor({
  label,
  description,
  values,
  onChange,
  suggestions = [],
  placeholder = "Add your own",
  maxItems = 20
}: {
  label: string;
  description?: string;
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  maxItems?: number;
}) {
  const [custom, setCustom] = useState("");
  const inputId = useId();
  const descriptionId = useId();

  const toggle = (value: string) => {
    const exists = values.some(
      (item) => item.toLocaleLowerCase() === value.toLocaleLowerCase()
    );
    onChange(
      exists
        ? values.filter(
            (item) => item.toLocaleLowerCase() !== value.toLocaleLowerCase()
          )
        : normalizeList([...values, value]).slice(0, maxItems)
    );
  };

  const addCustom = () => {
    const cleaned = cleanText(custom, LIMITS.listEntry);
    if (!cleaned || values.length >= maxItems) return;
    onChange(normalizeList([...values, cleaned]).slice(0, maxItems));
    setCustom("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addCustom();
    }
  };

  return (
    <fieldset>
      <legend className="label">{label}</legend>
      {description && (
        <p id={descriptionId} className="-mt-1 mb-4 text-sm leading-6 text-muted">
          {description}
        </p>
      )}
      {suggestions.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2" aria-label="Suggested choices">
          {suggestions.map((suggestion) => {
            const selected = values.some(
              (item) =>
                item.toLocaleLowerCase() === suggestion.toLocaleLowerCase()
            );
            return (
              <button
                key={suggestion}
                type="button"
                className={`chip ${selected ? "chip-selected" : ""}`}
                onClick={() => toggle(suggestion)}
                aria-pressed={selected}
              >
                {suggestion}
              </button>
            );
          })}
        </div>
      )}
      {values.length > 0 && (
        <ul className="mb-4 flex flex-wrap gap-2" aria-label="Your entries">
          {values
            .filter(
              (value) =>
                !suggestions.some(
                  (suggestion) =>
                    suggestion.toLocaleLowerCase() === value.toLocaleLowerCase()
                )
            )
            .map((value) => (
              <li key={value}>
                <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-sage-100 py-2 pl-4 pr-2 text-sm font-semibold text-sage-800">
                  {value}
                  <button
                    type="button"
                    className="grid size-8 place-items-center rounded-full hover:bg-white"
                    onClick={() =>
                      onChange(values.filter((item) => item !== value))
                    }
                    aria-label={`Remove ${value}`}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={inputId} className="sr-only">
          {placeholder}
        </label>
        <input
          id={inputId}
          className="field flex-1"
          value={custom}
          onChange={(event) =>
            setCustom(event.target.value.slice(0, LIMITS.listEntry))
          }
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          maxLength={LIMITS.listEntry}
          aria-describedby={description ? descriptionId : undefined}
          disabled={values.length >= maxItems}
        />
        <button
          type="button"
          className="btn-secondary shrink-0"
          onClick={addCustom}
          disabled={!custom.trim() || values.length >= maxItems}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        {values.length} of {maxItems} possible entries
      </p>
    </fieldset>
  );
}
