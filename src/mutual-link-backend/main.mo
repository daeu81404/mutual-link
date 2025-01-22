import DoctorManagement "./DoctorManagement";
import ApprovalManagement "./ApprovalManagement";
import Result "mo:base/Result";
import Nat "mo:base/Nat";

actor {
  private let doctorManager = DoctorManagement.DoctorManager();
  private let approvalManager = ApprovalManagement.ApprovalManager();

  public shared (_) func createDoctor(doctor: DoctorManagement.Doctor) : async Result.Result<DoctorManagement.Doctor, Text> {
    doctorManager.createDoctor(doctor)
  };

  public shared (_) func updateDoctor(doctor: DoctorManagement.Doctor) : async Result.Result<DoctorManagement.Doctor, Text> {
    doctorManager.updateDoctor(doctor)
  };

  public shared (_) func deleteDoctor(id: Nat) : async Result.Result<(), Text> {
    doctorManager.deleteDoctor(id)
  };

  public query func getPagedDoctors(offset: Nat, limit: Nat) : async DoctorManagement.PagedResult {
    doctorManager.getAllDoctors(offset, limit)
  };

  public query func getDoctor(id: Nat) : async ?DoctorManagement.Doctor {
    doctorManager.getDoctor(id)
  };

  public shared(msg) func updateDoctorPublicKey(email: Text, publicKey: Text) : async Result.Result<DoctorManagement.Doctor, Text> {
    doctorManager.updateDoctorPublicKey(email, ?publicKey)
  };

  public query func getDoctorByEmail(email: Text) : async ?DoctorManagement.Doctor {
    doctorManager.getDoctorByEmail(email)
  };

  public shared (_) func createApproval(approval: ApprovalManagement.Approval) : async Result.Result<ApprovalManagement.Approval, Text> {
    approvalManager.createApproval(approval)
  };

  public shared (_) func updateApprovalStatus(id: Nat, status: Text) : async Result.Result<ApprovalManagement.Approval, Text> {
    approvalManager.updateApprovalStatus(id, status)
  };

  public query func getPagedApprovals(offset: Nat, limit: Nat) : async ApprovalManagement.PagedResult {
    approvalManager.getAllApprovals(offset, limit)
  };

  public query func getApprovalsByDoctor(doctorName: Text, role: Text, offset: Nat, limit: Nat) : async ApprovalManagement.PagedResult {
    approvalManager.getApprovalsByDoctor(doctorName, role, offset, limit)
  };

  public query func getApproval(id: Nat) : async ?ApprovalManagement.Approval {
    approvalManager.getApproval(id)
  };

  public shared (_) func addTransferHistory(history: {
    id: Nat;
    fromDoctor: Text;
    fromEmail: Text;
    toDoctor: Text;
    toEmail: Text;
    date: Int;
    originalApprovalId: Nat;
  }) : async Result.Result<(), Text> {
    let transferHistory: ApprovalManagement.TransferHistory = {
      id = history.id;
      fromDoctor = history.fromDoctor;
      fromEmail = history.fromEmail;
      toDoctor = history.toDoctor;
      toEmail = history.toEmail;
      date = history.date;
      originalApprovalId = history.originalApprovalId;
    };
    approvalManager.addTransferHistory(transferHistory)
  };

  public query func getTransferHistories(approvalId: Nat) : async [ApprovalManagement.TransferHistory] {
    approvalManager.getTransferHistories(approvalId)
  };

  public query func getRelatedApprovals(originalId: Nat) : async [ApprovalManagement.Approval] {
    approvalManager.getRelatedApprovals(originalId)
  };
};
