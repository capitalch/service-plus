import { useState } from "react";
import { motion } from "framer-motion";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, X, Info } from "lucide-react";
import {
  zodDemoSchema,
  zodDemoDefaultValues,
  type ZodDemoFormData,
  Category,
  PRIORITY_OPTIONS,
  EMPLOYMENT_STATUS,
  SKILL_OPTIONS,
  COUNTRY_OPTIONS,
  RELATIONSHIP_TYPES,
} from "@/features/example-forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.4,
    },
  }),
};

interface ValidationBadgeProps {
  rules: string[];
}

function ValidationBadge({ rules }: ValidationBadgeProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="ml-2 inline-flex">
            <Info className="text-muted-foreground h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs font-medium">Validation Rules:</p>
          <ul className="mt-1 list-inside list-disc text-xs">
            {rules.map((rule, idx) => (
              <li key={idx}>{rule}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ZodForm() {
  const [submittedData, setSubmittedData] = useState<ZodDemoFormData | null>(null);

  const form = useForm<ZodDemoFormData>({
    resolver: zodResolver(zodDemoSchema),
    defaultValues: zodDemoDefaultValues,
    mode: "onChange",
  });

  const {
    fields: tagFields,
    append: appendTag,
    remove: removeTag,
  } = useFieldArray({
    control: form.control,
    name: "tags" as never,
  });

  const watchEmploymentStatus = form.watch("employmentStatus");

  const onSubmit = (data: ZodDemoFormData) => {
    console.log("Form submitted:", data);
    setSubmittedData(data);
    toast.success("Form submitted successfully!", {
      description: "All validations passed. Check console for data.",
    });
  };

  const handleReset = () => {
    form.reset(zodDemoDefaultValues);
    setSubmittedData(null);
    toast.info("Form has been reset");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="pb-12"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Zod Validation Demo</h1>
        <p className="text-muted-foreground mt-2">
          A comprehensive form demonstrating various Zod validation types with react-hook-form.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* STRING VALIDATIONS */}
          <motion.div
            custom={0}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    String
                  </Badge>
                  String Validations
                </CardTitle>
                <CardDescription>
                  Demonstrates min/max length, regex patterns, email, URL, and password validations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Username *
                          <ValidationBadge
                            rules={[
                              "3-20 characters",
                              "Letters, numbers, underscores only",
                            ]}
                          />
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="john_doe123" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Email *
                          <ValidationBadge rules={["Valid email format required"]} />
                        </FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        Website
                        <ValidationBadge rules={["Must be a valid URL with https://"]} />
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com" {...field} />
                      </FormControl>
                      <FormDescription>Optional</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Password *
                          <ValidationBadge
                            rules={[
                              "Min 8 characters",
                              "1 uppercase letter",
                              "1 lowercase letter",
                              "1 number",
                              "1 special character",
                            ]}
                          />
                        </FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Confirm Password *
                          <ValidationBadge rules={["Must match password"]} />
                        </FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* NUMBER VALIDATIONS */}
          <motion.div
            custom={1}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    Number
                  </Badge>
                  Number Validations
                </CardTitle>
                <CardDescription>
                  Demonstrates integer, min/max, positive, nonnegative, and decimal validations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="age"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Age *
                          <ValidationBadge
                            rules={["Integer only", "Min: 18", "Max: 120"]}
                          />
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="25"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === "" ? undefined : parseInt(e.target.value, 10)
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="salary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Salary *
                          <ValidationBadge
                            rules={["Positive number", "Max 2 decimal places"]}
                          />
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="50000.00"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === "" ? undefined : parseFloat(e.target.value)
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Quantity *
                          <ValidationBadge rules={["Integer only", "Non-negative"]} />
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === "" ? undefined : parseInt(e.target.value, 10)
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* DATE VALIDATIONS */}
          <motion.div
            custom={2}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-purple-50 text-purple-700">
                    Date
                  </Badge>
                  Date Validations
                </CardTitle>
                <CardDescription>
                  Demonstrates past date and future date validations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="birthDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Birth Date *
                          <ValidationBadge rules={["Must be in the past"]} />
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={
                              field.value instanceof Date
                                ? field.value.toISOString().split("T")[0]
                                : ""
                            }
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? new Date(e.target.value) : undefined
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="appointmentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Appointment Date *
                          <ValidationBadge rules={["Must be in the future"]} />
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={
                              field.value instanceof Date
                                ? field.value.toISOString().split("T")[0]
                                : ""
                            }
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? new Date(e.target.value) : undefined
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* BOOLEAN VALIDATIONS */}
          <motion.div
            custom={3}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-amber-50 text-amber-700">
                    Boolean
                  </Badge>
                  Boolean Validations
                </CardTitle>
                <CardDescription>
                  Demonstrates required checkbox (literal true) and optional boolean.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="termsAccepted"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value === true}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="flex items-center">
                          I accept the terms and conditions *
                          <ValidationBadge rules={["Must be checked (literal true)"]} />
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="newsletterOptIn"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="flex items-center">
                          Subscribe to newsletter
                          <ValidationBadge rules={["Optional boolean"]} />
                        </FormLabel>
                        <FormDescription>
                          Receive updates and promotions via email.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* ENUM/SELECT VALIDATIONS */}
          <motion.div
            custom={4}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-cyan-50 text-cyan-700">
                    Enum
                  </Badge>
                  Enum/Select Validations
                </CardTitle>
                <CardDescription>
                  Demonstrates z.enum, z.nativeEnum, and restricted values.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Priority *
                          <ValidationBadge rules={["z.enum(['low', 'medium', 'high', 'urgent'])"]} />
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PRIORITY_OPTIONS.map((priority) => (
                              <SelectItem key={priority} value={priority}>
                                {priority.charAt(0).toUpperCase() + priority.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Category *
                          <ValidationBadge rules={["z.nativeEnum(Category)"]} />
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(Category).map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Country *
                          <ValidationBadge rules={["Restricted to specific values"]} />
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COUNTRY_OPTIONS.map((country) => (
                              <SelectItem key={country.value} value={country.value}>
                                {country.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ARRAY VALIDATIONS */}
          <motion.div
            custom={5}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-pink-50 text-pink-700">
                    Array
                  </Badge>
                  Array Validations
                </CardTitle>
                <CardDescription>
                  Demonstrates array min/max length and uniqueness validations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Tags - Dynamic Array */}
                <div>
                  <FormLabel className="flex items-center mb-2">
                    Tags *
                    <ValidationBadge rules={["Min 1 tag", "Max 5 tags", "Non-empty strings"]} />
                  </FormLabel>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {tagFields.map((field, index) => (
                      <div key={field.id} className="flex items-center gap-1">
                        <Input
                          {...form.register(`tags.${index}` as const)}
                          className="w-32"
                          placeholder="Tag"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTag(index)}
                          className="h-8 w-8"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {tagFields.length < 5 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => appendTag("")}
                      >
                        <Plus className="mr-1 h-4 w-4" /> Add Tag
                      </Button>
                    )}
                  </div>
                  {form.formState.errors.tags && (
                    <p className="text-sm font-medium text-destructive">
                      {form.formState.errors.tags.message ||
                        form.formState.errors.tags.root?.message}
                    </p>
                  )}
                </div>

                {/* Skills - Multi-select */}
                <FormField
                  control={form.control}
                  name="skills"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        Skills *
                        <ValidationBadge rules={["Min 1 skill", "Must be unique"]} />
                      </FormLabel>
                      <div className="flex flex-wrap gap-2">
                        {SKILL_OPTIONS.map((skill) => {
                          const isSelected = field.value?.includes(skill.value);
                          return (
                            <Badge
                              key={skill.value}
                              variant={isSelected ? "default" : "outline"}
                              className={`cursor-pointer transition-all ${
                                isSelected
                                  ? "bg-primary"
                                  : "hover:bg-muted"
                              }`}
                              onClick={() => {
                                if (isSelected) {
                                  field.onChange(
                                    field.value?.filter((v: string) => v !== skill.value)
                                  );
                                } else {
                                  field.onChange([...(field.value || []), skill.value]);
                                }
                              }}
                            >
                              {skill.label}
                            </Badge>
                          );
                        })}
                      </div>
                      <FormDescription>Click to select/deselect skills</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* NESTED OBJECT VALIDATIONS */}
          <motion.div
            custom={6}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700">
                    Object
                  </Badge>
                  Nested Object Validations
                </CardTitle>
                <CardDescription>
                  Demonstrates nested object schemas with their own validations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Address */}
                <div>
                  <h4 className="mb-3 font-medium">Address</h4>
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="address.street"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center">
                            Street *
                            <ValidationBadge rules={["5-100 characters"]} />
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main St" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address.city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center">
                            City *
                            <ValidationBadge rules={["2-50 characters"]} />
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="New York" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address.zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center">
                            ZIP Code *
                            <ValidationBadge rules={["Format: 12345 or 12345-6789"]} />
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="10001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Emergency Contact */}
                <div>
                  <h4 className="mb-3 font-medium">Emergency Contact</h4>
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="emergencyContact.name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center">
                            Contact Name *
                            <ValidationBadge rules={["2-100 characters"]} />
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Jane Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="emergencyContact.phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center">
                            Contact Phone *
                            <ValidationBadge rules={["Valid phone format"]} />
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="+1 555 123 4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="emergencyContact.relationship"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center">
                            Relationship *
                            <ValidationBadge rules={["Select from predefined options"]} />
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select relationship" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {RELATIONSHIP_TYPES.map((rel) => (
                                <SelectItem key={rel} value={rel}>
                                  {rel.charAt(0).toUpperCase() + rel.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* CONDITIONAL VALIDATIONS */}
          <motion.div
            custom={7}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-orange-50 text-orange-700">
                    Conditional
                  </Badge>
                  Conditional Validations
                </CardTitle>
                <CardDescription>
                  Demonstrates superRefine for cross-field dependent validations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="employmentStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Employment Status *
                          <ValidationBadge rules={["Determines required fields"]} />
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {EMPLOYMENT_STATUS.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status
                                  .split("-")
                                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                                  .join("-")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Company Name
                          {(watchEmploymentStatus === "employed" ||
                            watchEmploymentStatus === "self-employed") && " *"}
                          <ValidationBadge
                            rules={["Required if employed or self-employed"]}
                          />
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Acme Inc."
                            {...field}
                            disabled={
                              watchEmploymentStatus !== "employed" &&
                              watchEmploymentStatus !== "self-employed"
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="studentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Student ID
                          {watchEmploymentStatus === "student" && " *"}
                          <ValidationBadge rules={["Required if student"]} />
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="STU123456"
                            {...field}
                            disabled={watchEmploymentStatus !== "student"}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* CUSTOM VALIDATIONS */}
          <motion.div
            custom={8}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-rose-50 text-rose-700">
                    Custom
                  </Badge>
                  Custom Validations
                </CardTitle>
                <CardDescription>
                  Demonstrates custom validation functions and transforms.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="creditCard"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Credit Card *
                          <ValidationBadge
                            rules={["Luhn algorithm validation", "13-19 digits"]}
                          />
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="4111 1111 1111 1111" {...field} />
                        </FormControl>
                        <FormDescription>
                          Test with: 4111111111111111
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Phone Number *
                          <ValidationBadge
                            rules={["Regex validation", "Transform: removes formatting"]}
                          />
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="+1 (555) 123-4567" {...field} />
                        </FormControl>
                        <FormDescription>
                          Formats are normalized on submit
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* SUBMIT BUTTONS */}
          <motion.div
            custom={9}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            className="flex gap-4"
          >
            <Button type="submit" size="lg">
              Submit Form
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={handleReset}>
              Reset
            </Button>
          </motion.div>

          {/* SUBMITTED DATA DISPLAY */}
          {submittedData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="text-green-800">Submitted Data</CardTitle>
                  <CardDescription className="text-green-700">
                    All validations passed. Here's the form data:
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-auto rounded-lg bg-white p-4 text-xs">
                    {JSON.stringify(submittedData, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </form>
      </Form>
    </motion.div>
  );
}
