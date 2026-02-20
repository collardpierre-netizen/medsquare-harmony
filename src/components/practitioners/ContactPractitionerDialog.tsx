import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";

const schema = z.object({
  name: z.string().min(2, "Veuillez entrer votre nom"),
  email: z.string().email("Email invalide"),
  phone: z.string().optional(),
  message: z.string().min(10, "Le message doit contenir au moins 10 caractères"),
});

type FormValues = z.infer<typeof schema>;

interface ContactPractitionerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practitionerName: string;
  practitionerEmail: string;
}

const ContactPractitionerDialog = ({
  open, onOpenChange, practitionerName, practitionerEmail,
}: ContactPractitionerDialogProps) => {
  const [sending, setSending] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", message: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("contact-practitioner", {
        body: {
          practitioner_email: practitionerEmail,
          practitioner_name: practitionerName,
          sender_name: values.name,
          sender_email: values.email,
          sender_phone: values.phone || undefined,
          message: values.message,
        },
      });

      if (error) throw error;

      toast.success("Message envoyé avec succès !");
      form.reset();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Contact error:", err);
      toast.error("Erreur lors de l'envoi du message. Veuillez réessayer.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Contacter {practitionerName}
          </DialogTitle>
          <DialogDescription>
            Envoyez un message directement à {practitionerName}. Votre email sera utilisé pour la réponse.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Votre nom *</FormLabel>
                  <FormControl><Input placeholder="Jean Dupont" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Votre email *</FormLabel>
                  <FormControl><Input type="email" placeholder="jean@exemple.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl><Input type="tel" placeholder="+32 xxx xx xx xx" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Votre message *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Bonjour, je souhaiterais prendre rendez-vous..."
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={sending}>
              {sending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Envoi en cours...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Envoyer le message</>
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ContactPractitionerDialog;
