import type { Service } from '@/content/services';

// Main service copy from Australian Citizenship.docx; original retained in content-input/.
// Detailed subclass guides remain separate. Reviewed factual corrections are recorded in IMPLEMENTATION.md.
export const australianCitizenship = {
  "heading": "Australian Citizenship: Requirements, Eligibility and How to Apply",
  "intro": [
    "Becoming an Australian citizen is the final step for many migrants. Citizenship gives you the right to hold an Australian passport, to vote, to live in Australia without a visa and to apply for certain jobs and roles that are open only to citizens. It also means that you will no longer have a visa that can expire or be cancelled, and that children born to you overseas may be eligible for citizenship by descent.",
    "For most permanent residents, the route is called citizenship by conferral. There are other routes, including citizenship by descent for people born overseas to an Australian citizen parent. Each has its own requirements, and the timing of your application matters, because the residence rules count days and absences precisely.",
    "This page explains who can apply, how the residence requirement works, how to prepare for the citizenship test, what the character and identity checks involve, what the application costs, how the ceremony works and what to think about before you apply, including dual nationality. It is written for permanent residents from Pakistan, India, Bangladesh, Sri Lanka, Europe and other regions.",
    "If you would like your eligibility checked by a person, Migration Factor offers a free consultation. You can {{consultation}} through our contact form. Nothing on this page guarantees a citizenship outcome or a timeframe. The rules, fees and processing times change, so please confirm the current position on the Department of Home Affairs website before you lodge."
  ],
  "sections": [
    {
      "id": "what-australian-citizenship-means",
      "heading": "What Australian Citizenship Means",
      "blocks": [
        {
          "type": "paragraph",
          "text": "An Australian citizen has rights and responsibilities that go beyond those of a permanent resident."
        },
        {
          "type": "list",
          "ordered": true,
          "items": [
            "The right to hold an Australian passport and to enter and leave Australia freely",
            "The right to vote in elections, which is compulsory for adult citizens, and to stand for office",
            "Access to jobs and roles that require citizenship, including some in the public service and defence",
            "Stability, because citizenship cannot expire like a visa",
            "The ability to pass on citizenship to children born overseas, subject to the rules",
            "Responsibilities such as obeying Australian law, serving on a jury when called and taking part in the democratic process"
          ]
        },
        {
          "type": "paragraph",
          "text": "Citizenship is also a legal and personal decision. It involves a pledge, and for some people it involves the rules of their country of origin about holding another nationality. Take the time to understand both sides."
        }
      ]
    },
    {
      "id": "ways-to-become-an-australian-citizen",
      "heading": "Ways to Become an Australian Citizen",
      "blocks": [
        {
          "type": "paragraph",
          "text": "There are several routes, and the one that fits you depends on your circumstances."
        },
        {
          "type": "list",
          "ordered": true,
          "items": [
            "Citizenship by conferral. For permanent residents and some other eligible people who meet the residence, test and character requirements. This is the route most migrants use",
            "Citizenship by descent. For people born outside Australia to a parent who was an Australian citizen",
            "Citizenship by birth in Australia. Depends on the status of the parents at the time of birth",
            "Other routes. Adoption and some special provisions apply to particular people and situations"
          ]
        },
        {
          "type": "paragraph",
          "text": "If you are unsure which route applies, take advice before you apply, because choosing the wrong application type can cost time and money."
        }
      ]
    },
    {
      "id": "who-can-apply-by-conferral",
      "heading": "Who Can Apply by Conferral",
      "blocks": [
        {
          "type": "paragraph",
          "text": "For the general eligibility route, the main requirements reported by current sources are:"
        },
        {
          "type": "list",
          "ordered": true,
          "items": [
            "You are a permanent resident, or an eligible New Zealand citizen who holds a Special Category visa, at the time of applying and at the time of the decision",
            "You meet the residence requirement, explained below",
            "You are of good character",
            "You pass the citizenship test, unless you are exempt",
            "You intend to live in Australia or maintain a close and continuing association with it",
            "You can prove your identity"
          ]
        },
        {
          "type": "paragraph",
          "text": "Applicants aged under 16 are usually included in a parent's application, and other rules apply to people aged 60 and over, those under 18 and people with certain medical conditions. Check the specific rules that apply to your age and circumstances."
        }
      ],
      "links": [
        {
          "label": "Home Affairs: citizenship by conferral",
          "href": "https://immi.homeaffairs.gov.au/citizenship/become-a-citizen/permanent-resident"
        }
      ]
    },
    {
      "id": "the-residence-requirement",
      "heading": "The Residence Requirement",
      "blocks": [
        {
          "type": "paragraph",
          "text": "The residence requirement is the most technical part of the application, and mistakes here are one of the most common reasons for delay."
        },
        {
          "type": "list",
          "ordered": true,
          "items": [
            "Four years of lawful residence in Australia immediately before you apply. Time on a valid visa counts, including time on a student, work or other visa",
            "At least 12 months as a permanent resident or Special Category visa holder immediately before you apply",
            "No more than 12 months in total outside Australia during the four years",
            "No more than 90 days outside Australia during the last 12 months before you apply"
          ]
        },
        {
          "type": "paragraph",
          "text": "These figures are reported by current practitioner sources, and the Department of Home Affairs states the official rules, so check them before you lodge. Some practitioner sources describe the 90 day limit as applying to the permanent resident year, so treat the exact wording as something to verify."
        },
        {
          "type": "heading",
          "text": "How to count your days"
        },
        {
          "type": "list",
          "ordered": true,
          "items": [
            "Collect your travel history, using your passports and your movement records",
            "Check your travel dates against your own records. If you need an official record of entries and exits, use the Department’s international movement records service. VEVO is for visa entitlements and conditions",
            "Count each trip outside Australia, including short holidays, business trips and visits home",
            "Count the days before your application date, not the day you plan to prepare it",
            "Leave a safety margin, because a miscount of a few days can matter"
          ]
        },
        {
          "type": "paragraph",
          "text": "If you are close to the limit, waiting a short time before lodging can avoid a refusal or a long delay. Take advice before you make that decision."
        }
      ],
      "links": [
        {
          "label": "Home Affairs: requesting travel records",
          "href": "https://immi.homeaffairs.gov.au/entering-and-leaving-australia/request-movement-records"
        }
      ]
    },
    {
      "id": "the-australian-citizenship-test",
      "heading": "The Australian Citizenship Test",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Most applicants aged 18 to 59 must sit the citizenship test. Current sources describe the format as follows."
        },
        {
          "type": "list",
          "ordered": true,
          "items": [
            "20 multiple choice questions, completed on a computer",
            "About 45 minutes",
            "A pass mark of 75 percent, which means at least 15 correct answers",
            "A requirement that all questions on Australian values are answered correctly, whatever the overall score",
            "Questions drawn from the official booklet Australian Citizenship: Our Common Bond",
            "Check the Department’s current rules for repeat test appointments and follow the instructions in your appointment letter"
          ]
        },
        {
          "type": "paragraph",
          "text": "The test is not about trick questions. It tests whether you understand the democratic beliefs, rights and liberties, government and laws, and shared values of Australia, together with some history and national symbols."
        },
        {
          "type": "heading",
          "text": "How to prepare"
        },
        {
          "type": "list",
          "ordered": true,
          "items": [
            "Read the official booklet more than once, and read it in the language you understand best, then check the English terms",
            "Pay special attention to the values questions, because every one must be correct",
            "Use official practice material and not unverified apps or websites",
            "Take your time during the test and read each question carefully",
            "If you do not pass, find out when you can sit the test again and what to review"
          ]
        },
        {
          "type": "paragraph",
          "text": "Applicants who are under 18, aged 60 and over, or who have a permanent or enduring incapacity are generally exempt from the test. Other exemptions may apply, and you may still be asked to attend an interview."
        }
      ],
      "links": [
        {
          "label": "Home Affairs: citizenship test",
          "href": "https://immi.homeaffairs.gov.au/citizenship-subsite/Pages/Test-and-interview/citizenship-test.aspx"
        }
      ]
    },
    {
      "id": "character-requirements",
      "heading": "Character Requirements",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Applicants aged 18 and over are assessed for good character. The Department considers your overall conduct, not only formal convictions. It may ask about criminal history, immigration compliance, and behaviour in Australia and overseas. You are usually asked to provide police certificates from the countries where you have lived for a set period, and to answer questions honestly."
        },
        {
          "type": "paragraph",
          "text": "Disclosing something is nearly always better than leaving it out. A past issue may be explainable, while a false or incomplete answer can be treated as a serious problem on its own. If you have any criminal history, a visa breach or any other concern, take advice before you lodge."
        }
      ]
    },
    {
      "id": "identity-and-documents",
      "heading": "Identity and Documents",
      "blocks": [
        {
          "type": "paragraph",
          "text": "You must be able to prove your identity, and the Department asks for documents that confirm it. A solid starting list includes:"
        },
        {
          "type": "list",
          "ordered": true,
          "items": [
            "Passports, including current and previous passports that show your travel history",
            "Your Australian visa grant notice and evidence of permanent residence",
            "Birth certificate or equivalent identity document, with a certified English translation if needed",
            "Evidence of any name change, such as a marriage certificate or deed poll",
            "Photo identity documents, such as a driver licence",
            "Evidence of your address, such as bills or bank statements",
            "Police certificates, where requested",
            "Evidence for any exemption you are claiming, such as medical documents"
          ]
        },
        {
          "type": "paragraph",
          "text": "The Department assesses documents as a whole and may ask for more. Names, dates and details must match across documents. If your records differ, for example because of a spelling variation in your name, explain the difference and attach supporting evidence."
        }
      ]
    },
    {
      "id": "how-to-apply-step-by-step",
      "heading": "How to Apply Step by Step",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Most applications are lodged online. The general sequence is below."
        },
        {
          "type": "list",
          "ordered": true,
          "items": [
            "Check that you meet the residence requirement, using your movement record",
            "Confirm that you are a permanent resident, or an eligible New Zealand citizen on a Special Category visa",
            "Prepare your identity documents and any police certificates",
            "Create or sign in to your online account and complete the application form carefully",
            "Pay the application charge",
            "Attend or book the citizenship test, if you are required to sit it",
            "Attend an interview if the Department asks for one",
            "Wait for the decision, and tell the Department about changes such as a new address",
            "If approved, wait for the invitation to a citizenship ceremony and attend it",
            "Make the Australian Citizenship Pledge, which is when you become a citizen"
          ]
        },
        {
          "type": "paragraph",
          "text": "Do not apply for an Australian passport, or enrol to vote as a citizen, before your ceremony. Until you make the pledge, you are still a permanent resident."
        }
      ]
    },
    {
      "id": "citizenship-application-fees",
      "heading": "Citizenship Application Fees",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Home Affairs Form 1298i, dated July 2026, lists AUD 595 for a general-eligibility adult citizenship by conferral application and AUD 85 for the eligible concession category. Children under 16 applying on the same form as a responsible parent have no separate charge. Eligibility for concessions and exemptions depends on the circumstances. Confirm the current fee and your application category before paying."
        },
        {
          "type": "paragraph",
          "text": "Other costs to consider include police certificates, certified translations, document copies and the cost of a passport once you are a citizen. Fees are generally not refunded if an application is refused."
        }
      ],
      "links": [
        {
          "label": "Home Affairs: citizenship application fees (Form 1298i, PDF)",
          "href": "https://immi.homeaffairs.gov.au/form-listing/forms/1298i.pdf"
        }
      ]
    },
    {
      "id": "processing-time",
      "heading": "Processing Time",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Processing time depends on the type of application, the completeness of your documents, any checks needed and the Department's workload. One practitioner source reports that standard applications were taking about 14 to 17 months from lodgement as of early 2026, after longer delays in earlier years. Treat this as an indication only, and check the Department's current processing times guide."
        },
        {
          "type": "paragraph",
          "text": "A complete application with accurate dates and clear documents is easier to assess. The Department does not generally speed up processing for individual cases, and agents cannot make the decision faster."
        }
      ]
    },
    {
      "id": "the-citizenship-ceremony-and-pledge",
      "heading": "The Citizenship Ceremony and Pledge",
      "blocks": [
        {
          "type": "paragraph",
          "text": "If your application is approved, you are invited to a citizenship ceremony, usually run by a local council. Practitioner sources suggest the invitation can take several months after approval, though timing varies by location. At the ceremony, you make the Australian Citizenship Pledge, and you become a citizen at that point."
        },
        {
          "type": "list",
          "ordered": true,
          "items": [
            "Bring the identification and documents listed in your invitation",
            "If you cannot attend, notify the Department promptly and ask for a new date",
            "After the ceremony, you receive your citizenship certificate",
            "You can then apply for an Australian passport and enrol to vote"
          ]
        },
        {
          "type": "paragraph",
          "text": "Keep your certificate in a safe place, because replacing it takes time."
        }
      ]
    },
    {
      "id": "dual-nationality-and-citizenship-renunciation",
      "heading": "Dual Nationality and Citizenship Renunciation",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Australian law generally allows citizens to hold another nationality, so becoming an Australian citizen does not require you to give up your Australian status if you also hold another. The key question is whether your country of origin allows you to hold another nationality."
        },
        {
          "type": "list",
          "ordered": true,
          "items": [
            "Some countries allow dual nationality, sometimes with conditions or with a list of recognised countries",
            "Some countries do not allow it, and a person who acquires another citizenship may lose their original citizenship",
            "Some countries offer a residency or overseas citizen status instead, which may protect some rights without full citizenship"
          ]
        },
        {
          "type": "paragraph",
          "text": "Check the law of your country of origin before you apply. For applicants from India, Pakistan, Bangladesh and Sri Lanka, the rules differ and change, so ask the relevant embassy or consulate, or take advice, and do not rely on general statements."
        }
      ]
    },
    {
      "id": "citizenship-by-descent",
      "heading": "Citizenship by Descent",
      "blocks": [
        {
          "type": "paragraph",
          "text": "A person born outside Australia to an Australian citizen parent may already be eligible for citizenship by descent. The application is different from citizenship by conferral. In general:"
        },
        {
          "type": "list",
          "ordered": true,
          "items": [
            "The parent must have been an Australian citizen at the time of the child's birth, and the rules can differ depending on whether the citizenship was by birth or by grant",
            "Apply for citizenship by descent if you are eligible; this is different from applying for evidence of citizenship if you are already an Australian citizen. The Department assesses your parent’s status and your relationship",
            "You need identity documents, the child's birth certificate showing the parent, and evidence of the parent's citizenship",
            "Character requirements can apply to adult applicants"
          ]
        },
        {
          "type": "paragraph",
          "text": "Because the rules depend on the dates and the parent's status, take advice if you are not sure whether you are already a citizen. Do not assume that a child born overseas is automatically a citizen without checking."
        }
      ],
      "links": [
        {
          "label": "Home Affairs: citizenship by descent",
          "href": "https://immi.homeaffairs.gov.au/citizenship/become-a-citizen/by-descent"
        }
      ]
    },
    {
      "id": "children-and-family",
      "heading": "Children and Family",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Children under 16 are usually included in a parent's application. Children born in Australia may be citizens, depending on the parents' status at the time of birth. Children born overseas to a citizen parent may be eligible by descent. If you are a permanent resident with children, check each child's position separately, because their eligibility can differ from yours."
        }
      ]
    },
    {
      "id": "common-reasons-for-delay-or-refusal",
      "heading": "Common Reasons for Delay or Refusal",
      "blocks": [
        {
          "type": "list",
          "ordered": true,
          "items": [
            "Not meeting the residence requirement, for example by miscounting absences",
            "Applying before holding permanent residence for the required period",
            "Incorrect or incomplete identity documents",
            "Name or date inconsistencies across documents",
            "Character concerns, including undisclosed criminal history or visa breaches",
            "Not passing the citizenship test, or missing the values questions",
            "Not attending an appointment, interview or ceremony without notice",
            "False or misleading information"
          ]
        },
        {
          "type": "paragraph",
          "text": "Many of these can be avoided by checking your dates and documents before you lodge. If your application is refused, read the decision carefully, because it explains the reasons and any review rights, and time limits can apply."
        }
      ]
    },
    {
      "id": "considerations-for-applicants-from-south-asia-and-europe",
      "heading": "Considerations for Applicants From South Asia and Europe",
      "blocks": [
        {
          "type": "paragraph",
          "text": "The requirements are the same for every nationality, but some practical points come up often."
        },
        {
          "type": "list",
          "ordered": true,
          "items": [
            "Travel records. Frequent visits home can add up quickly, so count your absences carefully",
            "Documents. Certified translations of documents in other languages should be clear, and names must match your passport",
            "Police certificates. Certificates from your home country can take time to obtain, so request them early",
            "Dual nationality. Check your country's rules before you apply, since they differ and change",
            "Name variations. Spelling differences between documents should be explained with evidence",
            "Preparation for the test. Use official material, and give extra time to the values questions"
          ]
        },
        {
          "type": "paragraph",
          "text": "Applicants from Europe often ask about holding two nationalities, which depends on the other country's law, so check before you apply."
        }
      ]
    },
    {
      "id": "how-professional-help-can-assist",
      "heading": "How Professional Help Can Assist",
      "blocks": [
        {
          "type": "paragraph",
          "text": "A migration professional cannot change the rules, guarantee a decision or make the Department process your application faster. What a good adviser can do is check your eligibility and your dates, identify the best time to lodge, review your documents, explain character questions, advise on dual nationality issues and help you decide between conferral and descent."
        },
        {
          "type": "paragraph",
          "text": "That review is most useful before you lodge, because fees are generally not refunded. Make sure anyone you pay for immigration advice in Australia is appropriately authorised, and ask to see their registration details."
        }
      ]
    },
    {
      "id": "why-consider-migration-factor",
      "heading": "Why Consider Migration Factor",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Migration Factor provides information and assistance on Australian visa pathways, including citizenship. We offer a free consultation where you can talk through your eligibility, your travel history and your documents before deciding on your next step. To arrange one, {{consultation}}."
        }
      ]
    },
    {
      "id": "frequently-asked-questions",
      "heading": "Frequently Asked Questions",
      "blocks": [
        {
          "type": "heading",
          "text": "How do I become an Australian citizen?"
        },
        {
          "type": "paragraph",
          "text": "Most permanent residents apply for citizenship by conferral. You need to meet the residence requirement, pass the citizenship test unless exempt, satisfy the character requirement, prove your identity and then make the pledge at a ceremony."
        },
        {
          "type": "heading",
          "text": "What are the Australian citizenship requirements?"
        },
        {
          "type": "paragraph",
          "text": "In general: permanent residence, four years of lawful residence with limits on time outside Australia, at least 12 months as a permanent resident, good character, passing the test and an intention to live in Australia or maintain a close link with it."
        },
        {
          "type": "heading",
          "text": "How long do I need to live in Australia?"
        },
        {
          "type": "paragraph",
          "text": "Sources report four years of lawful residence immediately before applying, including at least 12 months as a permanent resident, with no more than 12 months outside Australia in total and no more than 90 days in the last 12 months. Confirm the rules on the Department's website."
        },
        {
          "type": "heading",
          "text": "What is the citizenship test?"
        },
        {
          "type": "paragraph",
          "text": "It is a computer based test of 20 multiple choice questions with a 75 percent pass mark, and every Australian values question must be correct. It is based on the booklet Australian Citizenship: Our Common Bond."
        },
        {
          "type": "heading",
          "text": "How much does Australian citizenship cost?"
        },
        {
          "type": "paragraph",
          "text": "Sources report about AUD 595 for a standard adult application from 1 July 2026, covering the application, test and ceremony, with a concession fee for eligible pensioners. Confirm your exact fee on the Department's website."
        },
        {
          "type": "heading",
          "text": "How long does citizenship take?"
        },
        {
          "type": "paragraph",
          "text": "There is no fixed time. One practitioner source reports about 14 to 17 months in early 2026, but check the Department's processing times guide for the current position."
        },
        {
          "type": "heading",
          "text": "Do I become a citizen when my application is approved?"
        },
        {
          "type": "paragraph",
          "text": "No. You become a citizen when you make the Australian Citizenship Pledge at a ceremony. Until then you remain a permanent resident."
        },
        {
          "type": "heading",
          "text": "Can I hold dual nationality?"
        },
        {
          "type": "paragraph",
          "text": "Australian law generally allows it, but your other country may not. Check the law of your country of origin before you apply."
        },
        {
          "type": "heading",
          "text": "What is citizenship by descent?"
        },
        {
          "type": "paragraph",
          "text": "It is a citizenship application pathway for eligible people born outside Australia to a parent who was an Australian citizen at the time of birth. Applying for evidence of citizenship is a separate process for someone who is already a citizen. Check the rules for your parent’s status."
        },
        {
          "type": "heading",
          "text": "What documents do I need?"
        },
        {
          "type": "paragraph",
          "text": "Typically passports, evidence of permanent residence, identity documents such as a birth certificate, evidence of name changes, photo identification, address evidence and police certificates when requested."
        },
        {
          "type": "heading",
          "text": "Can my children be included?"
        },
        {
          "type": "paragraph",
          "text": "Children under 16 are usually included in a parent's application. Check each child's position separately, because eligibility can differ."
        },
        {
          "type": "heading",
          "text": "Why are citizenship applications refused?"
        },
        {
          "type": "paragraph",
          "text": "Common reasons include not meeting the residence requirement, identity or document problems, character concerns, failing the test and false or incomplete information."
        }
      ]
    },
    {
      "id": "next-step",
      "heading": "Next Step",
      "blocks": [
        {
          "type": "paragraph",
          "text": "If you are working out whether you are eligible, counting your days outside Australia or deciding between conferral and descent, {{consultation}} with Migration Factor. Please bring your passports, your visa grant notices and a record of your travel so the conversation can be specific."
        }
      ]
    }
  ],
  "sourceNote": "Planning information supplied by Migration Factor. Requirements, charges, program settings and processing times can change. Confirm the current official guidance and your individual circumstances before applying.",
  "seo": {
    "title": "Australian Citizenship: Eligibility & How to Apply",
    "description": "Understand Australian citizenship eligibility, residence requirements, the citizenship test, documents, fees, ceremonies and citizenship by descent."
  }
} satisfies Required<Pick<Service, 'heading' | 'intro' | 'sections' | 'sourceNote' | 'seo'>>;
