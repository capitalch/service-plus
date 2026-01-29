import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDispatch } from "react-redux";
import { useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  Mail,
  Lock,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { setCredentials } from "@/stores/auth.slice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

const clients = [
  "Acme Corporation",
  "TechStart Inc",
  "Global Services Ltd",
  "Digital Solutions",
  "Innovation Hub",
  "Prime Industries",
  "NextGen Tech",
  "Sunrise Enterprises",
  "Blue Ocean Corp",
  "Green Valley LLC",
] as const;

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  client: z.string().min(2, "Client must be at least 2 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      client: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Always login successfully
    dispatch(
      setCredentials({
        user: {
          id: "1",
          email: data.email,
          name: data.email.split("@")[0],
          client: data.client,
          roles: ["user"],
        },
        token: "mock-jwt-token-" + Date.now(),
      })
    );

    toast.success("Welcome back!", {
      description: `Logged in as ${data.email}`,
    });

    setIsLoading(false);
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Left side - Branding */}
      <div className="relative hidden w-1/2 overflow-hidden lg:block">
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl" />
          <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-600/10 blur-3xl" />
        </div>

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />

        {/* Content */}
        <div className="relative flex h-full flex-col items-center justify-center p-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <motion.div
              whileHover={{ scale: 1.05, rotate: 5 }}
              className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 shadow-2xl shadow-purple-500/30"
            >
              <Sparkles className="h-10 w-10 text-white" />
            </motion.div>

            <h1 className="mb-4 bg-gradient-to-r from-white via-purple-200 to-violet-200 bg-clip-text text-5xl font-bold text-transparent">
              Service Plus
            </h1>
            <p className="mb-8 max-w-md text-lg text-slate-400">
              Streamline your service management with our powerful platform.
              Built for teams who demand excellence.
            </p>

            {/* Feature highlights */}
            <div className="space-y-4">
              {[
                "Real-time ticket tracking",
                "Advanced analytics dashboard",
                "Seamless team collaboration",
              ].map((feature, index) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="flex items-center justify-center gap-3 text-slate-300"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-purple-500">
                    <ArrowRight className="h-3 w-3 text-white" />
                  </div>
                  {feature}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="mb-8 flex items-center justify-center lg:hidden">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 shadow-lg shadow-purple-500/30"
            >
              <Sparkles className="h-7 w-7 text-white" />
            </motion.div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-8 text-center">
              <h2 className="mb-2 text-2xl font-bold text-white">
                Welcome Back
              </h2>
              <p className="text-slate-400">Sign in to your account</p>
            </div>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-5"
              >
                {/* Client Selection */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <FormField
                    control={form.control}
                    name="client"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">
                          Client <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <Combobox
                              items={clients}
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <ComboboxInput
                                placeholder="Search clients..."
                                className="h-11 border-white/10 bg-white/5 pl-10 text-white placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20"
                              />
                              <ComboboxContent className="border-white/10 bg-slate-900">
                                <ComboboxEmpty className="text-slate-400">
                                  {field.value.length < 2
                                    ? "Type at least 2 characters"
                                    : "No clients found"}
                                </ComboboxEmpty>
                                <ComboboxList>
                                  {(item) => (
                                    <ComboboxItem
                                      key={item}
                                      value={item}
                                      className="text-slate-300 hover:bg-white/10 focus:bg-white/10"
                                    >
                                      {item}
                                    </ComboboxItem>
                                  )}
                                </ComboboxList>
                              </ComboboxContent>
                            </Combobox>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>

                {/* Email */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">
                          Email <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <Input
                              type="email"
                              placeholder="you@example.com"
                              className="h-11 border-white/10 bg-white/5 pl-10 text-white placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>

                {/* Password */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">
                          Password <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter your password"
                              className="h-11 border-white/10 bg-white/5 pl-10 pr-10 text-white placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>

                {/* Forgot password link */}
                <div className="text-right">
                  <a
                    href="#"
                    className="text-sm text-purple-400 hover:text-purple-300"
                  >
                    Forgot password?
                  </a>
                </div>

                {/* Submit Button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="h-11 w-full bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 font-medium text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-xl hover:shadow-purple-500/30"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </motion.div>

                {/* Footer */}
                <p className="text-center text-sm text-slate-500">
                  Don't have an account?{" "}
                  <a
                    href="#"
                    className="font-medium text-purple-400 hover:text-purple-300"
                  >
                    Contact admin
                  </a>
                </p>
              </form>
            </Form>
          </div>

          {/* Bottom text */}
          <p className="mt-8 text-center text-sm text-slate-600">
            Service Plus © 2026. All rights reserved.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
