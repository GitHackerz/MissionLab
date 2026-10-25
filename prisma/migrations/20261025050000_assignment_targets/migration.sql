-- DropIndex
DROP INDEX "Assignment_classroomId_missionId_key";

-- CreateTable
CREATE TABLE "AssignmentTarget" (
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "AssignmentTarget_pkey" PRIMARY KEY ("assignmentId","studentId")
);

-- CreateIndex
CREATE INDEX "AssignmentTarget_studentId_idx" ON "AssignmentTarget"("studentId");

-- CreateIndex
CREATE INDEX "Assignment_classroomId_idx" ON "Assignment"("classroomId");

-- AddForeignKey
ALTER TABLE "AssignmentTarget" ADD CONSTRAINT "AssignmentTarget_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentTarget" ADD CONSTRAINT "AssignmentTarget_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

