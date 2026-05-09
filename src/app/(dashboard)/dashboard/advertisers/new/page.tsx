import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { AdvertiserForm } from '@/components/dashboard/advertiser-form';

export const metadata = { title: 'Новый рекламодатель' };

export default function NewAdvertiserPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/dashboard/advertisers">
          <ArrowLeft className="h-3.5 w-3.5" />
          К списку
        </Link>
      </Button>

      <PageHeader
        title="Новый рекламодатель"
        description="Карточка с именем и контактами. Привязывать посты будем уже из композера."
      />

      <Card>
        <CardContent className="pt-5">
          <AdvertiserForm />
        </CardContent>
      </Card>
    </div>
  );
}
