import { createFileRoute } from "@tanstack/react-router";
import { LegalSection, MarketingShell } from "@/components/marketing-shell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — myNexClass" },
      {
        name: "description",
        content:
          "What myNexClass collects, who can see your classes, recordings and contact details, and how to ask for your data to be deleted.",
      },
      { property: "og:title", content: "Privacy Policy — myNexClass" },
      {
        property: "og:description",
        content: "What myNexClass collects, who can see it, and how to have it removed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <MarketingShell
      eyebrow="Legal"
      title="Privacy Policy"
      intro="This page is maintained by the myNexClass team to explain, in plain language, what the app stores and who can see it. It describes our current practices — it is not an independent audit or a certification."
    >
      <LegalSection heading="What we collect">
        <p>
          <strong className="text-foreground">Account details</strong> — your name, the email
          address you sign in with, and your role. If you sign in with Google we receive your name,
          email address and profile picture from Google.
        </p>
        <p>
          <strong className="text-foreground">Profile details</strong> — anything you choose to add:
          bio, subjects, languages, experience, hourly rate, profile photo, and a contact email or
          phone number.
        </p>
        <p>
          <strong className="text-foreground">Class data</strong> — the classes you schedule or
          attend, their times and time zones, requests you send or receive, availability slots,
          ratings, and the feedback a tutor writes after a lesson.
        </p>
        <p>
          <strong className="text-foreground">Recordings and uploads</strong> — video or audio files
          you upload for a class, and any links you save instead.
        </p>
        <p>
          <strong className="text-foreground">Assistant conversations</strong> — messages you send
          to the in-app assistant are processed to generate a reply.
        </p>
      </LegalSection>

      <LegalSection heading="Who can see it">
        <p>
          Access rules are enforced in the database itself, so the limits below apply to every
          request, not just to what the interface shows.
        </p>
        <p>
          Your profile name, bio, subjects and photo are visible to other signed-in users, which is
          how the tutor directory works. Your contact email and phone number are visible only to
          you, to administrators, and to people you actually share a class with.
        </p>
        <p>
          Classes, their notes, their feedback and their recordings are visible only to the tutor
          and the student in that class, and to administrators. Recordings in storage are private
          and are served through short-lived links.
        </p>
      </LegalSection>

      <LegalSection heading="Who we share it with">
        <p>
          We do not sell your data and we do not use it for advertising. We rely on a small number
          of providers to run the service: our hosting and database platform stores your account and
          class data, an email provider delivers class invitations and password resets, and an AI
          provider processes assistant messages to generate replies. Each is used only to deliver
          the feature it supports.
        </p>
      </LegalSection>

      <LegalSection heading="How long we keep it">
        <p>
          Account, profile and class records are kept while your account is open. Recordings stay
          until someone who uploaded them deletes them, or until you ask us to remove them. Deleting
          a class removes its notes and feedback.
        </p>
      </LegalSection>

      <LegalSection heading="Your choices">
        <p>
          You can edit or clear your profile and contact details at any time from your profile page,
          and delete recordings you uploaded. To request a copy of your data or the deletion of your
          account, email security@mynexclass.lovable.app and we will confirm within a few working
          days.
        </p>
      </LegalSection>

      <LegalSection heading="Cookies and tracking">
        <p>
          myNexClass stores your sign-in session in your browser so you stay logged in. We do not run
          advertising trackers or third-party analytics profiling on the site.
        </p>
      </LegalSection>

      <LegalSection heading="Children">
        <p>
          Students under the age of consent in their country should use myNexClass through a parent or
          guardian, who is responsible for the account and for the classes booked with it.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Privacy questions, data requests and responsible vulnerability reports go to
          security@mynexclass.lovable.app.
        </p>
      </LegalSection>
    </MarketingShell>
  );
}
